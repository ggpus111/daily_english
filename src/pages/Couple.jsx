import { useCallback, useEffect, useRef, useState } from 'react'
import AddPair from '../components/couple/AddPair'
import CoupleLeave from '../components/couple/CoupleLeave'
import CoupleToday from '../components/couple/CoupleToday'
import CoupleWaiting from '../components/couple/CoupleWaiting'
import PairAvatars from '../components/couple/PairAvatars'
import TodayFeed from '../components/couple/TodayFeed'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { coupleErrorKey, leaveCouple, loadPairs, sendSentence, setReaction, watchPairs } from '../lib/couple'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

const EMPTY = { loading: false, error: null, pairs: [] }
// 실시간 연결이 되어 있으면 가끔(안전망), 안 되어 있으면 자주 서버에서 다시 불러온다.
const POLL_TICK_MS = 5 * 1000
const CONNECTED_EVERY_TICKS = 6
const toState = (result) => (result.error ? { ...EMPTY, error: result.error } : { ...EMPTY, pairs: result.pairs })

/**
 * 친구·연인과 한 문장. 위에는 상대 동그라미 줄, 아래는 고른 것에 따라
 * 오늘 모아보기(아무도 안 골랐을 때) / 그 상대와 주고받기 / 상대 추가를 보여 준다.
 */
export default function Couple() {
  const { t, user, learningLang, notify, onLogin } = useApp()
  const userId = user?.id
  const [state, setState] = useState({ ...EMPTY, loading: Boolean(supabase && userId) })
  const [busy, setBusy] = useState(false)
  // null: 오늘 모아보기, 'add': 상대 추가, 그 밖: 고른 짝의 id
  const [selected, setSelected] = useState(null)

  const refresh = useCallback(async () => setState(toState(await loadPairs(userId))), [userId])

  useEffect(() => {
    if (!supabase || !userId) return undefined
    // 화면이 열릴 때 상대 목록을 서버에서 가져온다. 결과를 받은 뒤에만 상태를 바꾼다.
    let alive = true
    loadPairs(userId).then((result) => alive && setState(toState(result)))
    return () => {
      alive = false
    }
  }, [userId])

  // 새로고침하지 않아도 상대가 보낸 문장이 바로 보이게: 실시간 알림을 받는다.
  // 실시간 연결이 안 되어 있으면 5초마다, 연결되어 있어도 안전망으로 30초마다 다시 불러오고,
  // 앱 창으로 돌아오거나 인터넷이 다시 연결될 때도 바로 불러온다.
  const liveRef = useRef(false)
  useEffect(() => {
    if (!supabase || !userId) return undefined
    const refreshIfVisible = () => document.visibilityState === 'visible' && refresh()
    const stop = watchPairs(refresh, (status) => {
      liveRef.current = status === 'SUBSCRIBED'
    })
    let ticks = 0
    const timer = setInterval(() => {
      ticks += 1
      if (!liveRef.current || ticks % CONNECTED_EVERY_TICKS === 0) refreshIfVisible()
    }, POLL_TICK_MS)
    document.addEventListener('visibilitychange', refreshIfVisible)
    window.addEventListener('focus', refreshIfVisible)
    window.addEventListener('online', refreshIfVisible)
    return () => {
      stop()
      clearInterval(timer)
      liveRef.current = false
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.removeEventListener('focus', refreshIfVisible)
      window.removeEventListener('online', refreshIfVisible)
    }
  }, [userId, refresh])

  const fail = (error) => notify(t(coupleErrorKey(error) ?? 'coupleError', { message: errorMessage(error, t) }))

  // 서버 호출 뒤 화면을 새로 불러온다. 실패하면 알리고 false를 돌려준다.
  async function run(action, done) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (result.error) {
      fail(result.error)
      return false
    }
    done?.()
    await refresh()
    return true
  }

  const copyCode = (code) =>
    navigator.clipboard
      .writeText(code)
      .then(() => notify(t('coupleCopied')))
      .catch(() => notify(t('coupleCopyFail')))

  const react = (sentenceId, kind) => run(() => setReaction({ sentenceId, userId, kind }))

  const sendTo = (pairId) => (body) =>
    run(
      () => sendSentence({ coupleId: pairId, body, lang: learningLang }),
      () => notify(t('coupleSent')),
    )

  // 아직 안 보낸 상대 모두에게 같은 문장을 보낸다. 하나라도 실패하면 거기서 멈추고 알린다.
  const sendAll = (body, pairIds) =>
    run(
      async () => {
        for (const coupleId of pairIds) {
          const result = await sendSentence({ coupleId, body, lang: learningLang })
          if (result.error) return result
        }
        return {}
      },
      () => notify(t('feedSentAll', { count: pairIds.length })),
    )

  if (!supabase || !userId) {
    return (
      <>
        <PageHead title={t('couple')} intro={t('coupleIntro')} />
        <section className="paper-card couple-card">
          <p>{t('coupleNeedLogin')}</p>
          {supabase && (
            <button className="primary-button" onClick={onLogin}>
              {t('coupleLogin')}
            </button>
          )}
        </section>
      </>
    )
  }

  if (state.loading) {
    return (
      <p className="empty-state" role="status">
        {t('loadingPage')}
      </p>
    )
  }

  if (state.error) {
    return (
      <>
        <PageHead title={t('couple')} />
        <div className="error-banner" role="alert">
          <p>{t('coupleError', { message: errorMessage(state.error, t) })}</p>
          <button className="soft-button" onClick={refresh}>
            {t('retry')}
          </button>
        </div>
      </>
    )
  }

  const { pairs } = state
  const pair = pairs.find((item) => item.id === selected)
  const adding = selected === 'add' || pairs.length === 0

  let body
  if (adding) {
    body = <AddPair pairs={pairs} busy={busy} run={run} onDone={() => setSelected(null)} />
  } else if (pair) {
    const leave = (
      <CoupleLeave
        busy={busy}
        onLeave={() =>
          run(
            () => leaveCouple(pair.id),
            () => {
              setSelected(null)
              notify(t('coupleLeft'))
            },
          )
        }
      />
    )
    body = (
      <>
        <button className="text-button pair-back" onClick={() => setSelected(null)}>
          {t('pairBack')}
        </button>
        {pair.partner ? (
          <CoupleToday
            key={pair.id}
            userId={userId}
            partner={pair.partner}
            sentences={pair.sentences}
            reactions={pair.reactions}
            onReact={react}
            onSend={sendTo(pair.id)}
            onRefresh={refresh}
          />
        ) : (
          <CoupleWaiting code={pair.code} onRefresh={refresh} />
        )}
        {leave}
      </>
    )
  } else {
    body = (
      <TodayFeed
        pairs={pairs}
        userId={userId}
        busy={busy}
        onOpen={setSelected}
        onReact={react}
        onSendAll={sendAll}
        onCopy={copyCode}
        onRefresh={refresh}
      />
    )
  }

  return (
    <>
      <PageHead
        title={t('couple')}
        intro={pair?.partner ? t('couplePaired', { name: pair.partner.nickname }) : t('coupleIntro')}
      />
      {pairs.length > 0 && <PairAvatars pairs={pairs} userId={userId} selectedId={selected} onSelect={setSelected} />}
      {body}
    </>
  )
}
