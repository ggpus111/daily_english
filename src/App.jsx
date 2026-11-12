import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Icon from './components/Icon'
import { AppContext } from './context'
import { createTranslator } from './lib/i18n'
import { JOURNAL_DRAFT_KEY, STORAGE_ERROR, useRecords } from './lib/records'
import { local, session as sessionStore } from './lib/storage'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Chats from './pages/Chats'
import Entries from './pages/Entries'
import Home from './pages/Home'
import Journal from './pages/Journal'
import Privacy from './pages/Privacy'
import Profile from './pages/Profile'

const NAV = ['home', 'words', 'expressions', 'chats', 'journal', 'profile']
const TOAST_MS = 5000
const TOAST_ACTION_MS = 8000

function readPage() {
  const page = window.location.hash.slice(1)
  return NAV.includes(page) || page === 'privacy' ? page : 'home'
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

function Shell({ page, go, user, languages, t, notify }) {
  const { records, loading, loadError, add, update, remove, restore, removeAll } = useRecords(user)
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
      removeAll,
      go,
      ...languages,
    }),
    [t, notify, user, nickname, records, add, update, remove, restore, removeAll, go, languages],
  )

  const pages = {
    home: <Home />,
    words: <Entries key="word" type="word" />,
    expressions: <Entries key="expression" type="expression" />,
    chats: <Chats />,
    journal: <Journal />,
    profile: <Profile />,
  }

  return (
    <AppContext.Provider value={value}>
      <button className="skip-link" onClick={() => mainRef.current?.focus()}>
        {t('skipToContent')}
      </button>
      <div className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => go('home')}>
            <span className="brand-mark small" aria-hidden="true">
              d.
            </span>
            Daily English
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
                aria-current={page === id ? 'page' : undefined}
                onClick={() => go(id)}
              >
                <Icon name={id} />
                <span>{t(id)}</span>
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
            {loadError && (
              <p className="error-banner" role="alert">
                {loadError === STORAGE_ERROR
                  ? t('storageError')
                  : t('loadError', { message: loadError })}
              </p>
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

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') sessionStore.remove(JOURNAL_DRAFT_KEY)
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
  } else if (supabase && (!session || recovering)) {
    content = (
      <Auth t={t} notify={notify} recovering={recovering} onRecovered={() => setRecovering(false)} />
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
