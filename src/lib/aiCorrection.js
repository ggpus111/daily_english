// 앱 안 AI 일기 교정: 교정 요청문을 서버 함수(supabase/functions/correct-journal)로 보내 Google Gemini의 답을 받는다.
// 로그인해야 쓸 수 있고(하루 횟수 제한), 처음 쓸 때 어디로 보내지는지 알리고 동의를 받는다.
import { local } from './storage'
import { supabase } from './supabase'

export const AI_CONSENT_KEY = 'aiConsent'

export const aiConfigured = () => Boolean(supabase)
export const hasAiConsent = () => local.get(AI_CONSENT_KEY) === '1'
export const giveAiConsent = () => local.set(AI_CONSENT_KEY, '1')

/**
 * @returns {Promise<{ feedback: string, remaining: number } | { error: 'login'|'limit'|'busy'|'failed' }>}
 */
export async function requestCorrection(prompt) {
  if (!supabase) return { error: 'failed' }
  const { data, error } = await supabase.functions.invoke('correct-journal', { body: { prompt } })
  if (!error && data?.feedback) return { feedback: data.feedback, remaining: data.remaining ?? 0 }
  // 함수가 4xx·5xx로 답하면 supabase-js는 error.context에 응답을 넣어 준다.
  const status = error?.context?.status
  const body = await error?.context?.json?.().catch(() => null)
  const code = body?.error ?? data?.error
  if (status === 401 || code === 'login') return { error: 'login' }
  if (status === 429 || code === 'limit') return { error: 'limit' }
  if (code === 'busy' || status === 503) return { error: 'busy' }
  return { error: 'failed' }
}
