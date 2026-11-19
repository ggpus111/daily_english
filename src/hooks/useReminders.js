import { useEffect } from 'react'
import { REMINDERS_CHANGED } from '../components/ReminderSettings'
import { recordError } from '../lib/errorLog'
import { onReminderTap, scheduleReminders } from '../lib/notifications'
import { readSettings } from '../lib/reminders'

const PLAN_DELAY_MS = 800

// 기록이 바뀌거나 알림 설정을 바꾸면 알림을 다시 예약한다(목표를 채우면 그날 남은 목표 알림은 빠진다).
// 알림을 누르면 알림이 가리키는 화면(복습이면 홈, 목표면 일기 등)으로 간다.
export function useReminders({ records, loading, t, go }) {
  useEffect(() => {
    if (loading) return undefined
    const plan = () => scheduleReminders(records, readSettings(), t).catch((error) => recordError(error, 'app'))
    const timer = setTimeout(plan, PLAN_DELAY_MS)
    window.addEventListener(REMINDERS_CHANGED, plan)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(REMINDERS_CHANGED, plan)
    }
  }, [records, loading, t])

  useEffect(() => onReminderTap(go), [go])
}
