import { useState } from 'react'
import Field from '../components/Field'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { useAccountActions } from '../hooks/useAccountActions'
import { activityDays, streak } from '../lib/activity'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

const NICKNAME_MAX = 30
const MIN_PASSWORD_LENGTH = 6
const STATS = [
  ['word', 'profileWords'],
  ['expression', 'profileExpressions'],
  ['chat', 'profileChats'],
  ['journal', 'profileJournals'],
]

// 로그인한 방법(이메일, 구글, 카카오)을 이름으로 보여 준다.
const providerKey = (user) => {
  const provider = user?.app_metadata?.provider ?? 'email'
  return ['google', 'kakao'].includes(provider) ? `provider.${provider}` : 'provider.email'
}

/** 프로필: 내 이름과 계정, 내가 모은 기록 요약, 비밀번호 바꾸기. 알림·언어·데이터는 설정에 있다. */
export default function Profile() {
  const { t, notify, user, nickname, setNickname, records, go, onLogin, pendingCount, nativeLang } = useApp()
  const { logOut } = useAccountActions()
  const signedIn = Boolean(supabase && user)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(nickname)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [busy, setBusy] = useState(false)
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const days = activityDays(records)
  const joined = user?.created_at
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(user.created_at))
    : null
  const canChangePassword = signedIn && (user.app_metadata?.provider ?? 'email') === 'email'

  async function saveName(event) {
    event.preventDefault()
    const next = name.trim()
    if (!next) return
    setBusy(true)
    const result = await setNickname(next)
    setBusy(false)
    if (result?.error) {
      notify(t('profileNameError', { message: errorMessage(result.error, t) }))
      return
    }
    setEditing(false)
    notify(t('profileNameSaved'))
  }

  async function savePassword(event) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('passwordTooShort'))
      return
    }
    setPasswordError('')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      notify(t('authError', { message: errorMessage(error, t) }))
      return
    }
    setPassword('')
    notify(t('profilePasswordSaved'))
  }

  return (
    <>
      <PageHead title={t('profile')} intro={t('profileIntro')} />

      <div className="two-column even">
        <section className="panel profile-card" aria-labelledby="profile-name">
          <span className="avatar-large" aria-hidden="true">
            {nickname.slice(0, 1).toUpperCase()}
          </span>
          <h2 id="profile-name">{nickname}</h2>
          <dl>
            <dt>{t('email')}</dt>
            <dd>{user ? user.email || t('noEmail') : t('localMode')}</dd>
            {signedIn && (
              <>
                <dt>{t('profileLoginWith')}</dt>
                <dd>{t(providerKey(user))}</dd>
              </>
            )}
            {joined && (
              <>
                <dt>{t('profileJoined')}</dt>
                <dd>{joined}</dd>
              </>
            )}
          </dl>

          {editing ? (
            <form className="stack-form" onSubmit={saveName}>
              <Field
                label={t('nickname')}
                value={name}
                maxLength={NICKNAME_MAX}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="button-row">
                <button className="primary-button" disabled={busy || !name.trim()}>
                  {t('profileNameSave')}
                </button>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => {
                    setName(nickname)
                    setEditing(false)
                  }}
                >
                  {t('profileNameCancel')}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="soft-button"
              onClick={() => {
                setName(nickname)
                setEditing(true)
              }}
            >
              {t('profileNameEdit')}
            </button>
          )}

          {supabase && !user && (
            <>
              <button className="primary-button" onClick={onLogin}>
                {t('guestLogin')}
              </button>
              <p className="tiny-note">{t('guestLoginNote')}</p>
            </>
          )}
          {signedIn && (
            <>
              <button className="soft-button" onClick={logOut}>
                {t('logout')}
              </button>
              {pendingCount > 0 && <p className="tiny-note">{t('pendingOnLogout', { count: pendingCount })}</p>}
            </>
          )}
          {!supabase && <p className="tiny-note">{t('localModeNote')}</p>}
        </section>

        <section className="panel stack-form" aria-labelledby="profile-stats">
          <h2 id="profile-stats">{t('profileStats')}</h2>
          <ul className="stat-grid">
            {STATS.map(([type, label]) => (
              <li key={type}>
                <strong>{records[type].length}</strong>
                <span>{t(label)}</span>
              </li>
            ))}
            <li>
              <strong>{days.size}</strong>
              <span>{t('profileDays')}</span>
            </li>
            <li>
              <strong>{streak(days, new Date())}</strong>
              <span>{t('profileStreak')}</span>
            </li>
          </ul>
        </section>

        <section className="panel stack-form" aria-labelledby="profile-links">
          <h2 id="profile-links">{t('profileShortcuts')}</h2>
          <button className="soft-button" onClick={() => go('settings')}>
            {t('profileToSettings')}
          </button>
          <button className="soft-button" onClick={() => go('couple')}>
            {t('homeCoupleTitle')}
          </button>
        </section>

        {canChangePassword && (
          <section className="panel stack-form" aria-labelledby="profile-password">
            <h2 id="profile-password">{t('profilePassword')}</h2>
            <form className="stack-form" onSubmit={savePassword}>
              <Field
                type="password"
                label={t('profilePasswordNew')}
                autoComplete="new-password"
                value={password}
                error={passwordError}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button className="soft-button" disabled={busy || !password}>
                {t('profilePasswordSave')}
              </button>
            </form>
          </section>
        )}
      </div>
    </>
  )
}
