import { useCallback, useEffect, useRef, useState } from 'react'
import { latestPartnerSentence } from '../lib/couple'
import { local } from '../lib/storage'

const POLL_MS = 3 * 60 * 1000
const seenKey = (userId) => `coupleSeen:${userId}`

/**
 * 연인의 새 문장이 왔는지 살핀다(웹과 안드로이드 앱이 같다).
 * 앱을 열었거나 화면이 다시 보일 때, 그리고 열어 둔 동안 3분마다 확인해서 새 문장이 있으면 알림창과 홈의 표시로 알린다.
 * 브라우저를 닫은 웹 사용자는 서버가 보내는 웹 알림(supabase/schema.sql의 couple_sentence_notify)으로도 받는다.
 * 설정에서 "연인 새 문장 알림"을 켠 사람만 확인한다.
 */
export function useCoupleInbox({ userId, enabled, onNew }) {
  const [unread, setUnread] = useState(false)
  const latestId = useRef(null)
  const notifiedId = useRef(null)
  const onNewRef = useRef(onNew)

  useEffect(() => {
    onNewRef.current = onNew
  }, [onNew])

  const markSeen = useCallback(() => {
    if (userId && latestId.current != null) local.set(seenKey(userId), String(latestId.current))
    setUnread(false)
  }, [userId])

  useEffect(() => {
    if (!enabled || !userId) return undefined
    let alive = true

    async function check() {
      if (document.visibilityState === 'hidden') return
      const latest = await latestPartnerSentence(userId)
      if (!alive || !latest) return
      latestId.current = latest.id
      const seen = local.get(seenKey(userId))
      if (seen == null) {
        // 처음 켠 날에는 예전 문장을 새 문장으로 알리지 않는다.
        local.set(seenKey(userId), String(latest.id))
        return
      }
      if (String(latest.id) !== seen) {
        setUnread(true)
        if (notifiedId.current !== latest.id) {
          notifiedId.current = latest.id
          onNewRef.current?.()
        }
      }
    }

    check()
    const timer = setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [userId, enabled])

  return { unread: enabled && unread, markSeen }
}
