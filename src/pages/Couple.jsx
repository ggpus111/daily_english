import { useCallback, useEffect, useState } from 'react'
import CoupleLeave from '../components/couple/CoupleLeave'
import CoupleStart from '../components/couple/CoupleStart'
import CoupleToday from '../components/couple/CoupleToday'
import CoupleWaiting from '../components/couple/CoupleWaiting'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { coupleErrorKey, leaveCouple, loadCouple, sendSentence, setReaction } from '../lib/couple'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

const EMPTY = { loading: false, error: null, couple: null, members: [], sentences: [], reactions: [] }
const toState = (result) => (result.error ? { ...EMPTY, error: result.error } : { ...EMPTY, ...result })

/** 연인과 오늘의 한 문장. 짝이 있는지에 따라 시작 / 기다림 / 주고받기 화면을 고른다. */
export default function Couple() {
  const { t, user, learningLang, notify, onLogin } = useApp()
  const userId = user?.id
  const [state, setState] = useState({ ...EMPTY, loading: Boolean(supabase && userId) })
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => setState(toState(await loadCouple(userId))), [userId])

  useEffect(() => {
    if (!supabase || !userId) return undefined
    // 화면이 열릴 때 짝 정보를 서버에서 가져온다. 결과를 받은 뒤에만 상태를 바꾼다.
    let alive = true
    loadCouple(userId).then((result) => alive && setState(toState(result)))
    return () => {
      alive = false
    }
  }, [userId])

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

  const sendToday = (body) =>
    run(
      () => sendSentence({ coupleId: state.couple.id, body, lang: learningLang }),
      () => notify(t('coupleSent')),
    )

  const react = (sentenceId, kind) => run(() => setReaction({ sentenceId, userId, kind }))

  const leave = <CoupleLeave busy={busy} onLeave={() => run(leaveCouple, () => notify(t('coupleLeft')))} />

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

  if (!state.couple) {
    return (
      <>
        <PageHead title={t('couple')} intro={t('coupleIntro')} />
        <CoupleStart busy={busy} run={run} />
      </>
    )
  }

  const partner = state.members.find((member) => member.user_id !== userId)

  if (!partner) {
    return (
      <>
        <PageHead title={t('couple')} intro={t('coupleIntro')} />
        <CoupleWaiting code={state.couple.code} onRefresh={refresh} />
        {leave}
      </>
    )
  }

  return (
    <>
      <PageHead title={t('couple')} intro={t('couplePaired', { name: partner.nickname })} />
      <CoupleToday
        userId={userId}
        partner={partner}
        sentences={state.sentences}
        reactions={state.reactions}
        onReact={react}
        onSend={sendToday}
        onRefresh={refresh}
      />
      {leave}
    </>
  )
}
