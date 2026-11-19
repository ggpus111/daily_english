import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Icon from './components/Icon'
import Logo from './components/Logo'
import { AppContext } from './context'
import { useOnline } from './hooks/useOnline'
import { REMINDERS_CHANGED } from './components/ReminderSettings'
import { recordError, setErrorSender } from './lib/errorLog'
import { errorMessage } from './lib/errors'
import { createTranslator } from './lib/i18n'
import { initNativeAuth } from './lib/native'
import { onReminderTap, scheduleReminders } from './lib/notifications'
import { readSettings } from './lib/reminders'
import { JOURNAL_DRAFT_KEY, STORAGE_ERROR, useRecords } from './lib/records'
import { local } from './lib/storage'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Chats from './pages/Chats'
import Entries from './pages/Entries'
import Home from './pages/Home'
import Journal from './pages/Journal'
import Packs from './pages/Packs'
import Privacy from './pages/Privacy'
import Pro from './pages/Pro'
import Profile from './pages/Profile'

const NAV = ['home', 'words', 'expressions', 'packs', 'chats', 'journal', 'profile']
const TOAST_MS = 5000
const TOAST_ACTION_MS = 8000

function readPage() {
  const page = window.location.hash.slice(1)
  return NAV.includes(page) || ['privacy', 'pro', 'packs', 'packs-words'].includes(page) ? page : 'home'
}

function usePage() {
  const [page, setPage] = useState(readPage)

  useEffect(() => {
    const onChange = () => setPage(readPage())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const go = useCallback((next) => {
    window.location.hash = next
    window.scrollTo(0, 0)
  }, [])

  return [page, go]
}

function useLanguageSetting(key, fallback) {
  const [value, setValue] = useState(() => local.get(key) || fallback)
  const save = useCallback(
    (next) => {
      local.set(key, next)
      setValue(next)
    },
    [key],
  )
  return [value, save]
}

// action을 넘기면 알림 안에 버튼(예: 되돌리기)을 함께 보여 준다.
function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const notify = useCallback((message, action = null) => {
    clearTimeout(timer.current)
    setToast({ message, action })
    timer.current = setTimeout(() => setToast(null), action ? TOAST_ACTION_MS : TOAST_MS)
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])

  return [toast, notify, dismiss]
}

export const GUEST_KEY = 'guestMode'

function Shell({ page, go, user, languages, t, notify, onLogin }) {
  const {
    records,
    loading,
    loadError,
    pendingCount,
    reload,
    add,
    update,
    remove,
    restore,
    importRecords,
    removeAll,
  } = useRecords(user)
  const online = useOnline()
  const wasOnline = useRef(online)

  // 로그인했으면 앱 오류를 서버(client_errors)로도 보낸다. 기록 내용은 보내지 않는다(src/lib/errorLog.js).
  useEffect(() => {
    if (!supabase || !user) return undefined
    setErrorSender(async ({ source, message, stack, page: errorPage, version, platform, online: wasOnline, count }) => {
      const { error } = await supabase
        .from('client_errors')
        .insert({ source, message, stack, page: errorPage, version, platform, online: wasOnline, count })
      if (error) throw error
    })
    return () => setErrorSender(null)
  }, [user])

  // 기록이 바뀌거나 알림 설정을 바꾸면 알림을 다시 예약한다(목표를 채우면 그날 남은 목표 알림은 빠진다).
  useEffect(() => {
    if (loading) return undefined
    const plan = () => scheduleReminders(records, readSettings(), t).catch((error) => recordError(error, 'app'))
    const timer = setTimeout(plan, 800)
    window.addEventListener(REMINDERS_CHANGED, plan)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(REMINDERS_CHANGED, plan)
    }
  }, [records, loading, t])

  useEffect(() => onReminderTap(go), [go])

  // 연결이 돌아오면 못 올린 변경을 올리고, 다른 기기에서 바뀐 것까지 다시 불러온다.
  useEffect(() => {
    if (supabase && user && online && !wasOnline.current && loadError !== STORAGE_ERROR) reload()
    wasOnline.current = online
  }, [online, user, loadError, reload])
  const meta = user?.user_metadata ?? {}
  // 이메일 가입은 nickname, 원본 앱은 display_name, 구글과 카카오는 name 계열에 이름이 담긴다.
  const nickname =
    meta.nickname ||
    meta.display_name ||
    meta.name ||
    meta.full_name ||
    meta.user_name ||
    meta.preferred_username ||
    user?.email?.split('@')[0] ||
    'Learner'
  const mainRef = useRef(null)
  const previousPage = useRef(page)

  useEffect(() => {
    document.title = `${t(page)} · Daily English`
    if (previousPage.current !== page) mainRef.current?.focus({ preventScroll: true })
    previousPage.current = page
  }, [page, t])

  const value = useMemo(
    () => ({
      t,
      notify,
      user,
      nickname,
      records,
      add,
      update,
      remove,
      restore,
      importRecords,
      pendingCount,
      removeAll,
      go,
      onLogin,
      ...languages,
    }),
    [
      t,
      notify,
      user,
      nickname,
      records,
      add,
      update,
      remove,
      restore,
      importRecords,
      pendingCount,
      removeAll,
      go,
      onLogin,
      languages,
    ],
  )

  const pages = {
    home: <Home />,
    words: <Entries key="word" type="word" />,
    expressions: <Entries key="expression" type="expression" />,
    chats: <Chats />,
    journal: <Journal />,
    profile: <Profile />,
    pro: <Pro />,
    packs: <Packs key="expressions" mode="expressions" />,
    'packs-words': <Packs key="words" mode="words" />,
  }

  return (
    <AppContext.Provider value={value}>
      <button className="skip-link" onClick={() => mainRef.current?.focus()}>
        {t('skipToContent')}
      </button>
      <div className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => go('home')}>
            <Logo />
          </button>
          <button className="avatar-button" onClick={() => go('profile')} aria-label={t('profile')}>
            <span aria-hidden="true">{nickname.slice(0, 1).toUpperCase()}</span>
          </button>
        </header>
        <div className="layout">
          <nav className="sidebar" aria-label={t('mainNav')}>
            {NAV.map((id) => (
              <button
                key={id}
                className="nav-item"
                data-page={id}
                aria-current={page === id || (id === 'packs' && page === 'packs-words') ? 'page' : undefined}
                onClick={() => go(id)}
              >
                <Icon name={id} />
                <span>{t(id === 'packs' ? 'navPacks' : id)}</span>
              </button>
            ))}
            <div className="sidebar-user">
              <span className="avatar-button" aria-hidden="true">
                {nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="sidebar-user-text">
                <strong>{nickname}</strong>
                <small>{user ? user.email || t('noEmail') : t('localMode')}</small>
              </span>
            </div>
          </nav>
          <main className="main-content" ref={mainRef} tabIndex={-1}>
            {supabase && !online && (
              <p className="offline-banner" role="status">
                {t('offlineBanner')}
                {pendingCount > 0 && ` ${t('pendingCount', { count: pendingCount })}`}
              </p>
            )}
            {loadError && (
              <div className="error-banner" role="alert">
                <p>
                  {loadError === STORAGE_ERROR
                    ? t('storageError')
                    : t('loadError', { message: errorMessage(loadError, t) })}
                </p>
                {loadError !== STORAGE_ERROR && (
                  <button className="soft-button" onClick={reload}>
                    {t('retry')}
                  </button>
                )}
              </div>
            )}
            {loading ? (
              <p className="empty-state" role="status">
                {t('loadingRecords')}
              </p>
            ) : (
              pages[page]
            )}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  )
}

export default function App() {
  const [session, setSession] = useState(supabase ? undefined : null)
  const [recovering, setRecovering] = useState(false)
  // 로그인 없이 둘러보기(웹 첫 방문). 기록은 이 기기에만 남는다.
  const [guest, setGuest] = useState(() => local.get(GUEST_KEY) === '1')
  const [nativeLang, setNativeLang] = useLanguageSetting('nativeLang', 'ko')
  const [learningLang, setLearningLang] = useLanguageSetting('learningLang', 'en')
  const [page, go] = usePage()
  const [toast, notify, dismissToast] = useToast()
  const t = useMemo(() => createTranslator(nativeLang), [nativeLang])
  const languages = useMemo(
    () => ({ nativeLang, setNativeLang, learningLang, setLearningLang }),
    [nativeLang, setNativeLang, learningLang, setLearningLang],
  )

  useEffect(() => {
    document.documentElement.lang = nativeLang === 'ko' ? 'ko' : 'en'
  }, [nativeLang])

  // 안드로이드 앱에서 소셜 로그인·이메일 인증 후 딥링크로 돌아오는 것을 받는다.
  useEffect(
    () => initNativeAuth((error) => notify(t('authError', { message: errorMessage(error, t) }))),
    [notify, t],
  )

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_IN') {
        local.remove(GUEST_KEY)
        setGuest(false)
      }
      if (event === 'SIGNED_OUT') local.remove(JOURNAL_DRAFT_KEY)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  let content
  if (page === 'privacy') {
    content = <Privacy t={t} />
  } else if (session === undefined) {
    content = (
      <p className="auth-loading" role="status">
        {t('loadingAuth')}
      </p>
    )
  } else if (supabase && (recovering || (!session && !guest))) {
    content = (
      <Auth
        t={t}
        notify={notify}
        recovering={recovering}
        onRecovered={() => setRecovering(false)}
        onGuest={() => {
          local.set(GUEST_KEY, '1')
          setGuest(true)
        }}
      />
    )
  } else {
    content = (
      <Shell
        key={session?.user.id ?? 'local'}
        page={page}
        go={go}
        user={session?.user ?? null}
        languages={languages}
        t={t}
        notify={notify}
        onLogin={() => {
          local.remove(GUEST_KEY)
          setGuest(false)
        }}
      />
    )
  }

  return (
    <ErrorBoundary t={t}>
      {content}
      <div className={toast ? 'toast' : 'sr-only'} role="status">
        {toast?.message}
        {toast?.action && (
          <button
            className="toast-action"
            onClick={() => {
              dismissToast()
              toast.action.onClick()
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </ErrorBoundary>
  )
}
