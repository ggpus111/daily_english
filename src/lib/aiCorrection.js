// 앱 안 AI 일기 교정: 교정 요청문을 서버 함수(supabase/functions/correct-journal)로 보내 Google Gemini의 답을 받는다.
// 로그인해야 쓸 수 있고(하루 횟수 제한), 처음 쓸 때 어디로 보내지는지 알리고 동의를 받는다.
import { local } from './storage'
import { supabase } from './supabase'

export const AI_CONSENT_KEY = 'aiConsent'

export const aiConfigured = () => Boolean(supabase)
export const hasAiConsent = () => local.get(AI_CONSENT_KEY) === '1'
export const giveAiConsent = () => local.set(AI_CONSENT_KEY, '1')

// 교정 요청이 가고 있는 동안에는 다른 요청을 보내지 않는다. 연타해도, 화면 두 곳에서 눌러도 한 번에 하나만 가서
// 하루 횟수가 두 번 닳지 않는다. (화면의 버튼도 잠그지만, 화면 상태는 늦게 바뀌어서 여기서도 한 번 더 막는다.)
let inFlight = false
const REQUEST_TIMEOUT_MS = 60_000

/**
 * @returns {Promise<{ feedback: string, remaining: number } | { error: 'login'|'limit'|'busy'|'pending'|'failed', detail?: string }>}
 */
export async function requestCorrection(prompt) {
  if (inFlight) return { error: 'pending' }
  inFlight = true
  try {
    return await send(prompt)
  } finally {
    inFlight = false
  }
}

async function send(prompt) {
  if (!supabase) return { error: 'failed' }
  // 서버는 길어야 45초 안에 답한다. 그보다 오래 걸리면 기다리지 말고 끊어서 다시 누를 수 있게 한다.
  const { data, error } = await supabase.functions.invoke('correct-journal', { body: { prompt }, timeout: REQUEST_TIMEOUT_MS })
  if (!error && data?.feedback) return { feedback: data.feedback, remaining: data.remaining ?? 0 }
  // 서버까지 가지 못했거나 응답을 받지 못한 경우(인터넷 끊김, 서버 쪽 제한으로 연결이 끊김, 시간 초과).
  if (error?.name === 'FunctionsFetchError') {
    console.warn('[AI 교정 실패]', { name: error.name, message: error.message })
    return { error: 'network', detail: error.name }
  }
  // 함수가 4xx·5xx로 답하면 supabase-js는 error.context에 응답을 넣어 준다.
  const status = error?.context?.status
  const body = await error?.context?.json?.().catch(() => null)
  const code = body?.error ?? data?.error
  if (status === 401 || code === 'login') return { error: 'login' }
  if (status === 429 || code === 'limit') return { error: 'limit' }
  if (code === 'busy' || status === 503) return { error: 'busy' }
  // 원인을 화면에서 바로 알 수 있게 짧은 코드를 함께 돌려준다(예: "502 ai 404 NOT_FOUND"). 비밀 값은 들어 있지 않다.
  const detail = [status ?? error?.name, code, body?.upstream, body?.reason].filter(Boolean).join(' ')
  console.warn('[AI 교정 실패]', { status, code, upstream: body?.upstream, reason: body?.reason, message: error?.message })
  return { error: 'failed', detail }
}
