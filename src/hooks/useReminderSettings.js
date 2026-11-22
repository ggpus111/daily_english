import { useCallback, useEffect, useState } from 'react'
import { REMINDERS_CHANGED, readSettings, saveSettings } from '../lib/reminders'

/**
 * 알림·하루 목표 설정을 읽고 바꾼다. 설정 화면의 여러 칸이 같은 값을 보도록,
 * 바꿀 때마다 저장된 최신 값에 합치고 알림을 보내 다른 칸도 새로 읽게 한다(알림 다시 예약도 이 신호로 한다).
 */
export function useReminderSettings() {
  const [settings, setSettings] = useState(readSettings)

  useEffect(() => {
    const sync = () => setSettings(readSettings())
    window.addEventListener(REMINDERS_CHANGED, sync)
    return () => window.removeEventListener(REMINDERS_CHANGED, sync)
  }, [])

  const update = useCallback((patch) => {
    saveSettings({ ...readSettings(), ...patch })
    window.dispatchEvent(new Event(REMINDERS_CHANGED))
  }, [])

  return [settings, update]
}
