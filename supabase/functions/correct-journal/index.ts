// 앱 안 AI 일기 교정 (Supabase Edge Function).
// 앱(src/lib/aiCorrection.js)이 만든 교정 요청문(src/lib/correction.js의 buildCorrectionPrompt)을 받아
// Google Gemini API(무료 요금제)로 보내고, 답을 그대로 돌려준다. API 키는 이 서버에만 있다.
//
// - 로그인한 사용자만(요청의 JWT로 확인), 하루 DAILY_LIMIT번까지(ai_usage 표로 셈).
// - 요청문 길이를 제한해 다른 용도로 쓰이지 않게 한다.
// - 교정 내용은 저장하지 않는다.
//
// 필요한 비밀 값(Supabase 대시보드 > Edge Functions > Secrets):
//   GEMINI_API_KEY (Google AI Studio에서 무료로 발급), 선택: GEMINI_MODEL(기본 gemini-3.8-flash), AI_DAILY_LIMIT(기본 5)
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다.
import { createClient } from 'npm:@supabase/supabase-js@2'

// gemini-2.5-flash는 새 사용자에게 닫혀서(404) 3.8 flash로 바꿨다(무료 요금제 사용 가능, 2026-11-24 구글 문서 확인).
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
// 기본 모델이 바쁘거나 막혔을 때 차례로 쓰는 모델(콤마로 구분, GEMINI_FALLBACK_MODELS secret으로 바꿀 수 있다).
const FALLBACK_MODELS = (Deno.env.get('GEMINI_FALLBACK_MODELS') ?? 'gemini-3.6-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)
const DAILY_LIMIT =Number(Deno.env.get('AI_DAILY_LIMIT') ?? 5)
const MAX_PROMPT = 12000
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'method' }, 405)

  // 1. 로그인한 사용자인지
  const authorization = request.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: userData } = await userClient.auth.getUser()
  const user = userData?.user
  if (!user) return json({ error: 'login' }, 401)

  // 2. 요청문 확인
  const { prompt } = await request.json().catch(() => ({ prompt: '' }))
  if (typeof prompt !== 'string' || prompt.trim().length < 10 || prompt.length > MAX_PROMPT) {
    return json({ error: 'prompt' }, 400)
  }

  // 3. 오늘 몇 번 썼는지(한국 시간 기준 날짜)
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: usage } = await admin.from('ai_usage').select('count').eq('user_id', user.id).eq('day', day).maybeSingle()
  const used = usage?.count ?? 0
  if (used >= DAILY_LIMIT) return json({ error: 'limit', limit: DAILY_LIMIT, remaining: 0 }, 429)

  // 4. Gemini에 묻기
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    console.error('GEMINI_API_KEY secret이 없어요. Supabase > Edge Functions > Secrets에 넣어 주세요.')
    return json({ error: 'config' }, 500)
  }
  // 모델이 몰려서 바쁠 때(503)나 한도(429), 사라진 모델(404)이면 같은 모델을 한 번 더, 그래도 안 되면 다음 모델로 넘어간다.
  const askGemini = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          // "생각"에 쓰는 토큰도 출력 한도에 들어가서, 한도가 작으면 답이 비어 올 수 있어 넉넉히 잡는다.
          maxOutputTokens: 8192,
          // 2.5 모델만 생각을 끌 수 있다. 3.x 모델은 끌 수 없어서(설정하면 오류 가능) 건드리지 않는다.
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    })
  const models = [...new Set([MODEL, ...FALLBACK_MODELS])]
  let response: Response | null = null
  let lastStatus = 0
  let sawBusy = false // 한 번이라도 바쁨(429/503)이 있었으면, 마지막에 다른 오류가 나도 사용자에게는 "바빠요"로 알린다.
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await askGemini(model)
      if (response.ok) break
      lastStatus = response.status
      if (response.status === 429 || response.status === 503) sawBusy = true
      // 원인 확인용: Supabase 대시보드 > Edge Functions > correct-journal > Logs에서 볼 수 있다.
      console.error('Gemini 오류', response.status, model, (await response.text()).slice(0, 600))
      // 키·요청 문제(400/401/403)는 다른 모델로 바꿔도 같으니 바로 멈춘다.
      if (![429, 503, 404].includes(response.status)) break
      if (response.status === 503 && attempt === 0) await new Promise((r) => setTimeout(r, 1200))
      else break
    }
    if (response?.ok) break
    if (![429, 503, 404].includes(lastStatus)) break
  }
  if (!response?.ok) {
    const busy = sawBusy
    return json({ error: busy ? 'busy' : 'ai', upstream: lastStatus }, busy ? 503 : 502)
  }
  const result = await response.json()
  const feedback = (result.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim()
  if (!feedback) {
    console.error('Gemini가 빈 답을 보냈어요', JSON.stringify(result).slice(0, 600))
    return json({ error: 'ai', upstream: 'empty' }, 502)
  }

  // 5. 쓴 횟수 하나 늘리기(실패해도 교정은 돌려준다)
  await admin.from('ai_usage').upsert({ user_id: user.id, day, count: used + 1 }, { onConflict: 'user_id,day' })
  return json({ feedback, remaining: Math.max(0, DAILY_LIMIT - used - 1), limit: DAILY_LIMIT })
})
