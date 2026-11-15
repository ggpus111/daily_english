import { createClient } from '@supabase/supabase-js'
import { isNative } from './platform'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 서버가 응답하지 않을 때 계속 기다리지 않게 요청마다 시간 제한을 둔다.
export const REQUEST_TIMEOUT_MS = 15000

export function fetchWithTimeout(input, init = {}) {
  if (typeof AbortSignal.timeout !== 'function') return fetch(input, init)
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  if (!init.signal) return fetch(input, { ...init, signal: timeout })
  // 호출한 쪽의 취소 신호도 살린다. 둘을 합칠 수 없는 오래된 브라우저에서는 호출한 쪽을 따른다.
  if (typeof AbortSignal.any !== 'function') return fetch(input, init)
  return fetch(input, { ...init, signal: AbortSignal.any([init.signal, timeout]) })
}

// 환경 변수가 없으면 null이고, 앱은 로컬 모드로 동작한다.
// 안드로이드 앱은 주소창이 없어서 로그인 결과를 딥링크로 직접 받는다(src/lib/native.js).
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: isNative ? { flowType: 'pkce', detectSessionInUrl: false } : undefined,
        global: { fetch: fetchWithTimeout },
      })
    : null
