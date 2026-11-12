import { useState } from 'react'
import Field from '../components/Field'
import SocialLogin from '../components/SocialLogin'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD_LENGTH = 6

// 소셜 로그인을 취소하거나 실패하면 공급자가 주소에 오류를 붙여 돌려보낸다.
function readRedirectError() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const message = params.get('error_description') ?? hash.get('error_description')
  if (!message) return null
  window.history.replaceState(null, '', window.location.pathname)
  return message.replace(/\+/g, ' ')
}

export default function Auth({ t, notify, recovering, onRecovered }) {
  const [mode, setMode] = useState('login')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(() => {
    const redirectError = readRedirectError()
    return redirectError ? { error: true, text: t('authError', { message: redirectError }) } : null
  })
  const [busy, setBusy] = useState(false)

  function validate() {
    const next = {}
    if (!recovering && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t('emailInvalid')
    if (password.length < MIN_PASSWORD_LENGTH) next.password = t('passwordTooShort')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function changePassword() {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage({ error: true, text: t('newPasswordError', { message: error.message }) })
    } else {
      notify(t('newPasswordDone'))
      onRecovered()
    }
  }

  async function logIn() {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setMessage({ error: true, text: t('authError', { message: error.message }) })
  }

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nickname: nickname.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) setMessage({ error: true, text: t('authError', { message: error.message }) })
    else setMessage({ text: t(data.session ? 'signupDone' : 'signupConfirm') })
  }

  async function submit(event) {
    event.preventDefault()
    setMessage(null)
    if (!validate()) return

    setBusy(true)
    if (recovering) await changePassword()
    else if (mode === 'login') await logIn()
    else await signUp()
    setBusy(false)
  }

  async function resetPassword() {
    setMessage(null)
    if (!email.trim()) {
      setErrors({ email: t('resetNeedEmail') })
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setMessage(
      error
        ? { error: true, text: t('resetError', { message: error.message }) }
        : { text: t('resetSent') },
    )
  }

  function switchMode(next) {
    setMode(next)
    setErrors({})
    setMessage(null)
  }

  const submitLabel = recovering
    ? t('newPasswordSubmit')
    : t(mode === 'login' ? 'loginSubmit' : 'signupSubmit')

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            d.
          </span>
          <span className="muted">{t('authTagline')}</span>
        </div>
        <div>
          <h1>{t('welcomeBack')}</h1>
          <p className="muted">{t('authSubtitle')}</p>
        </div>

        {!recovering && (
          <div className="auth-tabs">
            <button aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>
              {t('login')}
            </button>
            <button aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>
              {t('signup')}
            </button>
          </div>
        )}

        {!recovering && (
          <SocialLogin t={t} onError={(text) => setMessage({ error: true, text })} />
        )}

        <form className="stack-form" onSubmit={submit} noValidate>
          {!recovering && mode === 'signup' && (
            <Field
              label={t('nickname')}
              autoComplete="nickname"
              maxLength={40}
              placeholder={t('nicknameHint')}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          )}
          {!recovering && (
            <Field
              label={t('email')}
              type="email"
              required
              autoComplete="email"
              placeholder="hello@example.com"
              value={email}
              error={errors.email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
          <Field
            label={recovering ? t('newPassword') : t('password')}
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete={mode === 'login' && !recovering ? 'current-password' : 'new-password'}
            placeholder={t('passwordHint')}
            value={password}
            error={errors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="text-button password-toggle"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {t('showPassword')}
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? t('wait') : submitLabel}
          </button>
        </form>

        <div role="status">
          {message && <p className={message.error ? 'field-error' : 'muted'}>{message.text}</p>}
        </div>

        {!recovering && mode === 'login' && (
          <button className="text-button" type="button" onClick={resetPassword}>
            {t('forgotPassword')}
          </button>
        )}
        {!recovering && <p className="tiny-note">{t('authNote')}</p>}
        <a className="inline-link tiny-note" href="#privacy">
          {t('privacy')}
        </a>
      </section>
    </main>
  )
}
