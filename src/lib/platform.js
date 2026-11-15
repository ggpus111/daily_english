import { Capacitor } from '@capacitor/core'

// 안드로이드 앱 안에서 돌고 있는지. 웹에서는 false다.
export const isNative = Capacitor.isNativePlatform()

// capacitor.config.json의 appId와 같아야 한다. AndroidManifest의 intent-filter도 이 값을 쓴다.
export const APP_SCHEME = 'com.dailyenglish.app'
const NATIVE_CALLBACK = `${APP_SCHEME}://auth-callback`

// 소셜 로그인과 이메일 인증이 돌아올 주소. 앱은 시스템 브라우저에서 딥링크로 돌아온다.
export const authRedirectUrl = () => (isNative ? NATIVE_CALLBACK : window.location.origin)

// 비밀번호 재설정은 웹에서 끝내는 편이 확실하다. 배포 주소가 있으면 그쪽으로 보낸다.
export const passwordResetUrl = () => {
  const site = import.meta.env.VITE_SITE_URL
  if (!isNative) return window.location.origin
  return site ? site.replace(/\/$/, '') : NATIVE_CALLBACK
}

export const isAuthCallback = (url) => url.startsWith(NATIVE_CALLBACK)
