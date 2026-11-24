// 앱 안 AI 일기 교정 (Supabase Edge Function).
// 앱(src/lib/aiCorrection.js)이 만든 교정 요청문(src/lib/correction.js의 buildCorrectionPrompt)을 받아
// Anthropic Claude API(유료, 충전식)로 보내고, 답을 그대로 돌려준다. Claude가 바쁘거나 막히면 Google Gemini
// API(무료 요금제)로 대신 보낸다. API 키는 이 서버에만 있다.
//
// - 로그인한 사용자만(요청의 JWT로 확인), 한 사람이 하루 DAILY_LIMIT번까지(ai_usage 표로 셈).
// - 모든 사용자를 합친 하루 한도(GLOBAL_DAILY_LIMIT)도 있어서, 비용이 한없이 늘지 않는다.
// - 요청문 길이를 제한해 다른 용도로 쓰이지 않게 한다.
// - 교정 내용은 저장하지 않는다.
//
// 필요한 비밀 값(Supabase 대시보드 > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY (Anthropic 콘솔에서 발급, 충전한 금액만큼만 쓰이게 자동 충전은 끈다)
//   선택: CLAUDE_MODEL(기본 claude-sonnet-5-5, 빠르고 싸게 하려면 claude-haiku-5-5)
//   GEMINI_API_KEY (Google AI Studio, 대체용), 선택: GEMINI_MODEL(기본 gemini-3.8-flash), GEMINI_FALLBACK_MODELS
//   선택: AI_DAILY_LIMIT(한 사람 하루, 기본 5), AI_PRO_DAILY_LIMIT(Pro 하루, 기본 20), AI_GLOBAL_DAILY_LIMIT(전체 하루, 기본 300)
//   선택: FREE_AI_PROVIDER(무료 사용자의 AI, 기본 claude. 학술제가 끝나면 gemini로 바꿔 무료로 돌린다)
// Pro 회원은 pro_members 표(관리자가 지정)로 확인한다. Pro는 항상 Claude만 쓰고, 대화 도우미(polish/explain/report)는 Pro만 쓴다.
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CLAUDE_MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5-5'
// gemini-2.5-flash는 새 사용자에게 닫혀서(404) 3.8 flash로 바꿨다(무료 요금제 사용 가능, 2026-11-24 구글 문서 확인).
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
// 기본 모델이 바쁘거나 막혔을 때 차례로 쓰는 모델(콤마로 구분, GEMINI_FALLBACK_MODELS secret으로 바꿀 수 있다).
const GEMINI_FALLBACKS = (Deno.env.get('GEMINI_FALLBACK_MODELS') ?? 'gemini-3.6-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 5)
const PRO_DAILY_LIMIT = Number(Deno.env.get('AI_PRO_DAILY_LIMIT') ?? 20)
// 무료 사용자의 AI: 'claude'(학술제 기간, 실패하면 Gemini로) 또는 'gemini'(무료 운영). Pro는 항상 Claude만 쓴다.
const FREE_PROVIDER = (Deno.env.get('FREE_AI_PROVIDER') ?? 'claude').trim().toLowerCase()
// 요청 종류: 일기 교정, 문법 확인, 그리고 Pro만 쓰는 대화 도우미(보내기 전 다듬기, 받은 메시지 풀이, 주간 리포트).
const KINDS = ['journal', 'grammar', 'polish', 'explain', 'report']
const PRO_KINDS = ['polish', 'explain', 'report']
const GLOBAL_DAILY_LIMIT = Number(Deno.env.get('AI_GLOBAL_DAILY_LIMIT') ?? 300)
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

// 한 번 물어본 결과. 실패하면 상태 번호와 오류 종류(키 값은 들어 있지 않다)를 담는다.
type Attempt = { ok: true; feedback: string } | { ok: false; status: number; reason: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const reasonOf = (text: string, pick: (parsed: any) => unknown) => {
  try {
    return String(pick(JSON.parse(text)) ?? '').slice(0, 40)
  } catch {
    return ''
  }
}

async function askClaude(prompt: string, apiKey: string, timeoutMs: number): Promise<Attempt> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    })
    const text = await response.text()
    if (!response.ok) {
      // 원인 확인용: Supabase 대시보드 > Edge Functions > correct-journal > Logs에서 볼 수 있다.
      console.error('Claude 오류', response.status, CLAUDE_MODEL, text.slice(0, 600))
      return { ok: false, status: response.status, reason: reasonOf(text, (parsed) => parsed?.error?.type) }
    }
    const feedback = (JSON.parse(text).content ?? [])
      .filter((block: { type?: string }) => block.type === 'text')
      .map((block: { text?: string }) => block.text ?? '')
      .join('')
      .trim()
    if (!feedback) {
      console.error('Claude가 빈 답을 보냈어요', text.slice(0, 600))
      return { ok: false, status: 502, reason: 'empty' }
    }
    return { ok: true, feedback }
  } catch (error) {
    console.error('Claude 연결 실패', String(error))
    return { ok: false, status: 504, reason: 'timeout' } // 시간 초과나 연결 실패는 바쁨처럼 다룬다.
  }
}

async function askGemini(prompt: string, apiKey: string, model: string, timeoutMs: number, withThinking: boolean): Promise<Attempt> {
  // 2.5 모델은 "생각"을 끌 수 있고, 3.x 모델은 끌 수 없어 가장 낮은 단계(low)로 낮춰 빨리 답하게 한다.
  const thinking = !withThinking
    ? {}
    : model.startsWith('gemini-2.5')
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : { thinkingConfig: { thinkingLevel: 'low' } }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // "생각"에 쓰는 토큰도 출력 한도에 들어가서, 한도가 작으면 답이 비어 올 수 있어 넉넉히 잡는다.
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, ...thinking },
      }),
    })
    const text = await response.text()
    if (!response.ok) {
      console.error('Gemini 오류', response.status, model, text.slice(0, 600))
      return { ok: false, status: response.status, reason: reasonOf(text, (parsed) => parsed?.error?.status) }
    }
    const feedback = (JSON.parse(text).candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim()
    if (!feedback) {
      console.error('Gemini가 빈 답을 보냈어요', text.slice(0, 600))
      return { ok: false, status: 502, reason: 'empty' }
    }
    return { ok: true, feedback }
  } catch (error) {
    console.error('Gemini 연결 실패', String(error))
    return { ok: false, status: 504, reason: 'timeout' }
  }
}

type Outcome =
  | { ok: true; feedback: string; by: string }
  | { ok: false; error: 'busy' | 'ai'; upstream: number; reason: string }

/**
 * 순서대로 물어본다: Claude(키가 있을 때) → Gemini 모델들. 느리거나 바쁘면 오래 붙잡지 않고 다음으로 넘어간다.
 * 한 번에 25초, 전체 45초로 끊는다. (오래 끌면 사용자가 다시 눌러 요청이 쌓이고 연결이 끊긴다.)
 */
async function askAi(prompt: string, claudeKey: string | undefined, geminiKey: string | undefined): Promise<Outcome> {
  const deadline = Date.now() + 45_000
  const BUSY = [429, 503, 504, 529]
  let lastStatus = 0
  let lastReason = ''
  let sawBusy = false // 한 번이라도 바쁨이 있었으면, 마지막에 다른 오류가 나도 사용자에게는 "바빠요"로 알린다.
  const fail = (attempt: Attempt & { ok: false }) => {
    lastStatus = attempt.status
    lastReason = attempt.reason
    if (BUSY.includes(attempt.status)) sawBusy = true
  }
  const timeLeft = () => Math.min(25_000, deadline - Date.now())

  if (claudeKey) {
    for (let attempt = 0; attempt < 2 && timeLeft() >= 3000; attempt++) {
      const result = await askClaude(prompt, claudeKey, timeLeft())
      if (result.ok) return { ok: true, feedback: result.feedback, by: CLAUDE_MODEL }
      fail(result)
      // 서버가 몰린 경우만 한 번 더. 키·잔액·요청 문제는 Gemini로 넘어간다.
      if (![503, 529].includes(result.status) || attempt === 1) break
      await sleep(1200)
    }
  }

  if (geminiKey) {
    for (const model of [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACKS])]) {
      let withThinking = true
      for (let attempt = 0; attempt < 2 && timeLeft() >= 3000; attempt++) {
        const result = await askGemini(prompt, geminiKey, model, timeLeft(), withThinking)
        if (result.ok) return { ok: true, feedback: result.feedback, by: model }
        fail(result)
        // "생각" 설정을 모델이 거부하면 설정 없이 같은 모델로 한 번 더(시도 횟수는 쓰지 않는다).
        if (result.status === 400 && withThinking) {
          withThinking = false
          attempt -= 1
          continue
        }
        if (result.status === 503 && attempt === 0) await sleep(1200)
        else break
      }
      // 키·요청 문제(400/401/403)는 다른 모델로 바꿔도 같으니 멈춘다.
      if (![404, ...BUSY].includes(lastStatus)) break
    }
  }
  return { ok: false, error: sawBusy ? 'busy' : 'ai', upstream: lastStatus, reason: lastReason }
}

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
  const body = await request.json().catch(() => ({}))
  const prompt = body?.prompt
  if (typeof prompt !== 'string' || prompt.trim().length < 10 || prompt.length > MAX_PROMPT) {
    return json({ error: 'prompt' }, 400)
  }
  const kind = KINDS.includes(body?.kind) ? body.kind : 'journal'

  // 3. Pro 회원인지(관리자가 지정한 계정). Pro 기능은 Pro만 쓴다.
  const { data: proRow } = await admin.from('pro_members').select('user_id').eq('user_id', user.id).maybeSingle()
  const isPro = Boolean(proRow)
  if (PRO_KINDS.includes(kind) && !isPro) return json({ error: 'pro' }, 403)
  const limit = isPro ? PRO_DAILY_LIMIT : DAILY_LIMIT

  // 4. 오늘 몇 번 썼는지(한국 시간 기준 날짜): 이 사람 몫과 모두를 합친 몫
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: rows } = await admin.from('ai_usage').select('user_id, count').eq('day', day)
  const used = rows?.find((row) => row.user_id === user.id)?.count ?? 0
  if (used >= limit) return json({ error: 'limit', limit, remaining: 0 }, 429)
  const total = (rows ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0)
  if (total >= GLOBAL_DAILY_LIMIT) return json({ error: 'full' }, 503)

  // 5. AI에게 묻기: Pro는 Claude만(보낸 내용을 학습에 쓰지 않는 유료 AI라고 약속했으니 무료 Gemini로 넘기지 않는다).
  //    무료 사용자는 FREE_AI_PROVIDER가 claude면 Claude 다음 Gemini, gemini면 Gemini만.
  const claudeKey = isPro || FREE_PROVIDER === 'claude' ? Deno.env.get('ANTHROPIC_API_KEY') : undefined
  const geminiKey = isPro ? undefined : Deno.env.get('GEMINI_API_KEY')
  if (!claudeKey && !geminiKey) {
    console.error('AI 키가 없어요. Supabase > Edge Functions > Secrets에 ANTHROPIC_API_KEY(또는 GEMINI_API_KEY)를 넣어 주세요.')
    return json({ error: 'config' }, 500)
  }
  const outcome = await askAi(prompt, claudeKey, geminiKey)
  if (!outcome.ok) {
    return json(
      { error: outcome.error, upstream: outcome.upstream, reason: outcome.reason },
      outcome.error === 'busy' ? 503 : 502,
    )
  }

  // 6. 쓴 횟수 하나 늘리기(실패해도 교정은 돌려준다)
  await admin.from('ai_usage').upsert({ user_id: user.id, day, count: used + 1 }, { onConflict: 'user_id,day' })
  return json({
    feedback: outcome.feedback,
    remaining: Math.max(0, limit - used - 1),
    limit,
    pro: isPro,
    by: outcome.by,
  })
})
