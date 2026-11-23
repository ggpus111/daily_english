import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Icon from './components/Icon'
import Logo from './components/Logo'
import { AppContext } from './context'
import { useErrorReporting } from './hooks/useErrorReporting'
import { useOnline } from './hooks/useOnline'
import { useCoupleInbox } from './hooks/useCoupleInbox'
import { useReminders } from './hooks/useReminders'
import { clearDraftBackup } from './lib/draftBackup'
import { errorMessage } from './lib/errors'
import { createTranslator } from './lib/i18n'
import { initNativeAuth } from './lib/native'
import { readSettings, REMINDERS_CHANGED } from './lib/reminders'
import { JOURNAL_DRAFT_KEY, STORAGE_ERROR, useRecords } from './lib/records'
import { local } from './lib/storage'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Chats from './pages/Chats'
import Entries from './pages/Entries'
import Home from './pages/Home'
import Journal from './pages/Journal'
import Packs from './pages/Packs'
import Profile from './pages/Profile'

// 자주 열지 않는 화면은 처음 열 때 따로 불러와 첫 화면 코드를 줄인다.
const Admin = lazy(() => import('./pages/Admin'))
const Couple = lazy(() => import('./pages/Couple'))
const Settings = lazy(() => import('./pages/Settings'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Pro = lazy(() => import('./pages/Pro'))
const Missed = lazy(() => import('./pages/Missed'))

const NAV = ['home', 'words', 'expressions', 'packs', 'chats', 'journal', 'profile']
const TOAST_MS = 5000
const TOAST_ACTION_MS = 8000

function readPage() {
  const page = window.location.hash.slice(1)
  return NAV.includes(page) || ['privacy', 'pro', 'packs', 'packs-words', 'admin', 'couple', 'settings', 'missed'].includes(page)
    ? page
    : 'home'
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
  const { records, loading, loadError, pendingCount, reload, add, update, remove, restore, importRecords, removeAll } =
    useRecords(user)
  const online = useOnline()
  const wasOnline = useRef(online)

  useErrorReporting(user)
  useReminders({ records, loading, t, go, signedIn: Boolean(supabase && user) })

  // 연결이 돌아오면 못 올린 변경을 올리고, 다른 기기에서 바뀐 것까지 다시 불러온다.
  useEffect(() => {
    if (supabase && user && online && !wasOnline.current && loadError !== STORAGE_ERROR) reload()
    wasOnline.current = online
  }, [online, user, loadError, reload])
  // 로그인하지 않은 사람의 이름은 이 기기에만 남긴다.
  const [guestName, setGuestName] = useLanguageSetting('guestNickname', '')
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
    guestName ||
    'Learner'
  const mainRef = useRef(null)
  const previousPage = useRef(page)

  // 이름 바꾸기: 로그인했으면 계정에, 아니면 이 기기에 저장한다.
  const setNickname = useCallback(
    async (name) => {
      if (supabase && user) {
        const { error } = await supabase.auth.updateUser({ data: { nickname: name } })
        return error ? { error } : {}
      }
      setGuestName(name)
      return {}
    },
    [user, setGuestName],
  )

  // 연인의 새 문장이 오면 알려 준다(설정에서 켠 사람만). 연인과 한 문장 화면을 열면 읽은 것으로 한다.
  const [coupleOn, setCoupleOn] = useState(() => readSettings().couple)
  useEffect(() => {
    const sync = () => setCoupleOn(readSettings().couple)
    window.addEventListener(REMINDERS_CHANGED, sync)
    return () => window.removeEventListener(REMINDERS_CHANGED, sync)
  }, [])
  const { unread: coupleUnread, markSeen: markCoupleSeen } = useCoupleInbox({
    userId: supabase ? user?.id : null,
    enabled: coupleOn,
    onNew: () => notify(t('coupleNewToast'), { label: t('coupleNewOpen'), onClick: () => go('couple') }),
  })
  useEffect(() => {
    if (page === 'couple') markCoupleSeen()
  }, [page, markCoupleSeen])

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
      setNickname,
      coupleUnread,
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
      setNickname,
      coupleUnread,
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
    admin: <Admin />,
    couple: <Couple />,
    settings: <Settings />,
    missed: <Missed />,
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
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => go('settings')}
              aria-label={t('settings')}
              aria-current={page === 'settings' ? 'page' : undefined}
            >
              <Icon name="settings" />
            </button>
            <button className="avatar-button" onClick={() => go('profile')} aria-label={t('profile')}>
              <span aria-hidden="true">{nickname.slice(0, 1).toUpperCase()}</span>
            </button>
          </div>
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
              <Suspense
                fallback={
                  <p className="empty-state" role="status">
                    {t('loadingPage')}
                  </p>
                }
              >
                {pages[page]}
              </Suspense>
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
  // 영어 문구는 한국어가 아닌 사람만 필요해서 처음 화면 코드에 넣지 않고, 필요할 때 받는다.
  const [englishStrings, setEnglishStrings] = useState(null)
  const needsEnglish = nativeLang !== 'ko' && !englishStrings
  // 처음부터 영어로 연 사람만 문구가 올 때까지 기다린다. 쓰다가 영어로 바꾸면 화면을 그대로 두고 문구만 바꾼다.
  const [startedInEnglish] = useState(() => nativeLang !== 'ko')
  useEffect(() => {
    if (!needsEnglish) return undefined
    let alive = true
    import('./lib/strings.en').then((module) => alive && setEnglishStrings(module.default))
    return () => {
      alive = false
    }
  }, [needsEnglish])
  const t = useMemo(
    () => createTranslator(needsEnglish ? 'ko' : nativeLang, englishStrings ?? {}),
    [nativeLang, englishStrings, needsEnglish],
  )
  const languages = useMemo(
    () => ({ nativeLang, setNativeLang, learningLang, setLearningLang }),
    [nativeLang, setNativeLang, learningLang, setLearningLang],
  )

  useEffect(() => {
    document.documentElement.lang = nativeLang === 'ko' ? 'ko' : 'en'
  }, [nativeLang])

  // 안드로이드 앱에서 소셜 로그인·이메일 인증 후 딥링크로 돌아오는 것을 받는다.
  useEffect(() => initNativeAuth((error) => notify(t('authError', { message: errorMessage(error, t) }))), [notify, t])

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
      if (event === 'SIGNED_OUT') {
        local.remove(JOURNAL_DRAFT_KEY)
        clearDraftBackup()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  let content
  if (needsEnglish && startedInEnglish) {
    content = (
      <p className="auth-loading" role="status">
        Loading…
      </p>
    )
  } else if (page === 'privacy') {
    content = (
      <Suspense fallback={null}>
        <Privacy t={t} />
      </Suspense>
    )
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
