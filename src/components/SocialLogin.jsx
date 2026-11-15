import { useState } from 'react'
import { openExternal } from '../lib/native'
import { authRedirectUrl, isNative } from '../lib/platform'
import { supabase } from '../lib/supabase'

// 쓸 수 있는 공급자만 버튼을 보인다. Supabase에서 켜지 않은 공급자를 누르면 오류가 난다.
const ENABLED = (import.meta.env.VITE_AUTH_PROVIDERS ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

function KakaoMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#000"
        d="M12 3C6.48 3 2 6.48 2 10.77c0 2.77 1.86 5.2 4.66 6.57l-.95 3.48c-.08.3.26.54.52.37l4.14-2.74c.53.06 1.07.09 1.63.09 5.52 0 10-3.48 10-7.77S17.52 3 12 3z"
      />
    </svg>
  )
}

const PROVIDERS = {
  google: { label: 'loginGoogle', Mark: GoogleMark },
  kakao: { label: 'loginKakao', Mark: KakaoMark },
}

export default function SocialLogin({ t, onError }) {
  const [busy, setBusy] = useState('')
  const providers = ENABLED.filter((name) => PROVIDERS[name])
  if (providers.length === 0) return null

  async function signIn(provider) {
    setBusy(provider)
    // 앱은 웹뷰 안에서 구글 로그인을 할 수 없어서 시스템 브라우저로 연다.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl(), skipBrowserRedirect: isNative },
    })
    if (error) {
      onError(t('authError', { message: error.message }))
      setBusy('')
      return
    }
    if (isNative) {
      await openExternal(data.url)
      setBusy('')
    }
    // 웹은 공급자 로그인 화면으로 이동하므로 여기서 할 일이 없다.
  }

  return (
    <div className="social-login">
      {providers.map((name) => {
        const { label, Mark } = PROVIDERS[name]
        return (
          <button
            key={name}
            type="button"
            className={`social-button ${name}`}
            disabled={Boolean(busy)}
            onClick={() => signIn(name)}
          >
            <Mark />
            {t(busy === name ? 'wait' : label)}
          </button>
        )
      })}
      <p className="divider">
        <span>{t('orEmail')}</span>
      </p>
    </div>
  )
}
