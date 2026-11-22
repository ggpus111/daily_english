// 앱 안 AI 일기 교정 (Supabase Edge Function).
// 앱(src/lib/aiCorrection.js)이 만든 교정 요청문(src/lib/correction.js의 buildCorrectionPrompt)을 받아
// Google Gemini API(무료 요금제)로 보내고, 답을 그대로 돌려준다. API 키는 이 서버에만 있다.
//
// - 로그인한 사용자만(요청의 JWT로 확인), 하루 DAILY_LIMIT번까지(ai_usage 표로 셈).
// - 요청문 길이를 제한해 다른 용도로 쓰이지 않게 한다.
// - 교정 내용은 저장하지 않는다.
//
// 필요한 비밀 값(Supabase 대시보드 > Edge Functions > Secrets):
//   GEMINI_API_KEY (Google AI Studio에서 무료로 발급), 선택: GEMINI_MODEL(기본 gemini-2.5-flash), AI_DAILY_LIMIT(기본 5)
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 5)
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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    },
  )
  if (!response.ok) {
    const busy = response.status === 429 || response.status === 503
    return json({ error: busy ? 'busy' : 'ai' }, busy ? 503 : 502)
  }
  const result = await response.json()
  const feedback = (result.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim()
  if (!feedback) return json({ error: 'ai' }, 502)

  // 5. 쓴 횟수 하나 늘리기(실패해도 교정은 돌려준다)
  await admin.from('ai_usage').upsert({ user_id: user.id, day, count: used + 1 }, { onConflict: 'user_id,day' })
  return json({ feedback, remaining: Math.max(0, DAILY_LIMIT - used - 1), limit: DAILY_LIMIT })
})
