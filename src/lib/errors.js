// 네트워크·서버 오류를 사용자가 알아들을 수 있는 말로 바꾼다.
// 알아볼 수 없는 오류는 받은 문구를 그대로 보여 준다.

const FETCH_FAILED = /failed to fetch|networkerror|network request failed|load failed|err_internet|err_network/i
const TIMED_OUT = /timeout|timed out|signal is aborted|aborted/i
const SERVER_DOWN = /\b5\d\d\b|internal server error|bad gateway|service unavailable|gateway time-?out/i

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * @param {unknown} error Error, Supabase 오류 객체({ message, status }) 또는 문자열
 * @returns {'offline' | 'connection' | 'timeout' | 'server' | null}
 */
export function errorKind(error) {
  const message = typeof error === 'string' ? error : (error?.message ?? '')
  const name = typeof error === 'object' ? (error?.name ?? '') : ''
  const status = typeof error === 'object' ? Number(error?.status) : NaN

  if (name === 'TimeoutError' || TIMED_OUT.test(message)) return 'timeout'
  // 로그인 쪽은 5xx도 AuthRetryableFetchError로 주므로 상태 코드를 먼저 본다.
  if (status >= 500 || SERVER_DOWN.test(message)) return 'server'
  if (FETCH_FAILED.test(message) || name === 'AuthRetryableFetchError') return isOffline() ? 'offline' : 'connection'
  if (isOffline()) return 'offline'
  return null
}

const KIND_KEY = {
  offline: 'errOffline',
  connection: 'errConnection',
  timeout: 'errTimeout',
  server: 'errServer',
}

/** 오류를 화면에 보여 줄 한 문장으로 만든다. */
export function errorMessage(error, t) {
  const kind = errorKind(error)
  if (kind) return t(KIND_KEY[kind])
  if (typeof error === 'string') return error
  return error?.message || t('errUnknown')
}

/** 다시 시도하면 나아질 수 있는 오류인지. */
export const isRetryable = (error) => errorKind(error) !== null

/** 서버 호출이 실패했을 때 화면 쪽에 돌려주는 모양: { error: { message, status } } */
export const failure = (error) => ({ error: { message: error?.message ?? String(error), status: error?.status } })
