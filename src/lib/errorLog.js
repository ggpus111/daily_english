// 앱에서 난 오류를 모은다(오류 추적).
// - 사용자 기록(단어, 일기 내용)은 넣지 않는다. 오류 메시지, 코드 위치, 화면, 앱 버전, 웹/앱 구분만 남긴다.
// - 이 기기에 최근 30개를 두고(프로필에서 보고 복사할 수 있음), 로그인했으면 서버(client_errors 표)에도 보낸다.
// - 서버로 보내다 실패해도 앱 동작에는 영향이 없다.
import { isNative } from './platform'
import { local } from './storage'

export const ERROR_LOG_KEY = 'errorLog'
const MAX_ENTRIES = 30
const MAX_MESSAGE = 300
const MAX_STACK = 800

let sender = null

/** 로그인했을 때 서버로 보내는 함수를 정한다(App에서 연결). 없으면 기기에만 남긴다. */
export function setErrorSender(send) {
  sender = send
}

export function readErrorLog() {
  const list = local.getJson(ERROR_LOG_KEY)
  return Array.isArray(list) ? list : []
}

export function clearErrorLog() {
  local.remove(ERROR_LOG_KEY)
}

function describe(error) {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack ?? '' }
  if (typeof error === 'string') return { message: error, stack: '' }
  try {
    return { message: JSON.stringify(error), stack: '' }
  } catch {
    return { message: String(error), stack: '' }
  }
}

// 스택에서 파일 경로의 주소 부분만 줄여 남긴다(같은 오류를 묶어 보기 쉽게).
const trimStack = (stack) =>
  stack
    .split('\n')
    .slice(0, 6)
    .map((line) => line.replace(/https?:\/\/[^/\s)]+/g, '').trim())
    .join('\n')
    .slice(0, MAX_STACK)

/** 오류 하나를 기록한다. 같은 화면에서 같은 오류가 이어지면 count만 늘린다. */
export function recordError(error, source = 'app') {
  const { message, stack } = describe(error)
  const entry = {
    at: new Date().toISOString(),
    source,
    message: String(message).slice(0, MAX_MESSAGE),
    stack: trimStack(stack),
    page: typeof location === 'undefined' ? '' : location.hash.slice(1) || 'home',
    version: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
    platform: isNative ? 'android' : 'web',
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    count: 1,
  }

  const list = readErrorLog()
  const last = list[0]
  if (last && last.message === entry.message && last.page === entry.page && last.source === entry.source) {
    last.count += 1
    last.at = entry.at
  } else {
    list.unshift(entry)
  }
  local.set(ERROR_LOG_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))

  if (sender) {
    Promise.resolve()
      .then(() => sender(entry))
      .catch(() => {
        // 보내지 못해도 기기에는 남아 있다.
      })
  }
  return entry
}

let started = false

/** 처리하지 못한 오류와 거부된 Promise를 모두 잡는다. */
export function initErrorTracking() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('error', (event) => recordError(event.error ?? event.message, 'window'))
  window.addEventListener('unhandledrejection', (event) => recordError(event.reason, 'promise'))
}

/** 지원 문의에 붙여 넣을 수 있는 글로 만든다. */
export function formatErrorLog(list = readErrorLog()) {
  return list
    .map((item) => `[${item.at}] ${item.platform} ${item.version} #${item.page} (${item.source}, ${item.count}회)\n${item.message}\n${item.stack}`)
    .join('\n\n')
}
