import DataSection from '../components/settings/DataSection'
import HelpSection from '../components/settings/HelpSection'
import NotificationSection from '../components/settings/NotificationSection'
import StudySection from '../components/settings/StudySection'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { useAccountActions } from '../hooks/useAccountActions'
import { supabase } from '../lib/supabase'

/** 설정: 알림, 학습과 화면, 개인정보와 데이터, 도움말을 한곳에 모았다. 계정과 내 기록은 프로필에 있다. */
export default function Settings() {
  const { t, user, nickname, go, onLogin, pendingCount } = useApp()
  const { logOut } = useAccountActions()
  const signedIn = Boolean(supabase && user)

  return (
    <>
      <PageHead title={t('settings')} intro={t('settingsIntro')} />

      <button className="panel account-summary" onClick={() => go('profile')}>
        <span className="avatar-large" aria-hidden="true">
          {nickname.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-summary-text">
          <strong>{nickname}</strong>
          <small>{user ? user.email || t('noEmail') : t('localMode')}</small>
        </span>
        <span className="account-summary-go">{t('settingsToProfile')}</span>
      </button>

      <div className="settings-stack">
        <NotificationSection />
        <StudySection />
        <DataSection />
        <HelpSection />

        <section className="panel settings-group" aria-labelledby="settings-session">
          <h2 id="settings-session">{t('account')}</h2>
          {signedIn ? (
            <>
              <button className="soft-button" onClick={logOut}>
                {t('logout')}
              </button>
              {pendingCount > 0 && <p className="tiny-note">{t('pendingOnLogout', { count: pendingCount })}</p>}
            </>
          ) : supabase ? (
            <>
              <button className="primary-button" onClick={onLogin}>
                {t('guestLogin')}
              </button>
              <p className="tiny-note">{t('guestLoginNote')}</p>
            </>
          ) : (
            <p className="tiny-note">{t('localModeNote')}</p>
          )}
        </section>
      </div>
    </>
  )
}
