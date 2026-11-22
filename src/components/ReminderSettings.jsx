import { useEffect, useState } from 'react'
import { useApp } from '../context'
import ChoiceChips from './ChoiceChips'
import { notificationPermission, requestNotificationPermission } from '../lib/notifications'
import { isNative } from '../lib/platform'
import { GOALS, REVIEW_TIMES, planReminders, readSettings, saveSettings } from '../lib/reminders'

export const REMINDERS_CHANGED = 'reminders-changed'

// 프로필의 "알림" 칸: 하루 목표, 목표 알림, 복습 알림. 켤 때만 알림 권한을 묻는다.
export default function ReminderSettings() {
  const { t, notify, records, nativeLang } = useApp()
  const [settings, setSettings] = useState(readSettings)
  const [permission, setPermission] = useState('prompt')
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const timeFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  const next = planReminders(records, settings)[0]

  useEffect(() => {
    notificationPermission()
      .then(setPermission)
      .catch(() => setPermission('unsupported'))
  }, [])

  async function change(patch) {
    const nextSettings = { ...settings, ...patch }
    const turningOn = (patch.goalReminder || patch.reviewReminder) === true
    if (turningOn && permission !== 'granted') {
      const result = await requestNotificationPermission().catch(() => 'denied')
      setPermission(result)
      if (result !== 'granted') {
        notify(t(result === 'unsupported' ? 'reminderUnsupported' : 'reminderDenied'))
        return
      }
    }
    setSettings(nextSettings)
    saveSettings(nextSettings)
    window.dispatchEvent(new Event(REMINDERS_CHANGED))
  }

  return (
    <section className="panel stack-form" aria-labelledby="reminder-title">
      <h2 id="reminder-title">{t('reminderTitle')}</h2>
      <p className="muted">{t('reminderBody')}</p>

      <ChoiceChips
        compact
        label={t('reminderGoal')}
        name="daily-goal"
        value={settings.goal}
        options={GOALS.map((goal) => ({ value: goal, label: goal === 0 ? t('reminderGoalOff') : t('reminderGoalCount', { count: goal }) }))}
        onChange={(goal) => change({ goal: Number(goal) })}
      />

      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.goalReminder && settings.goal > 0}
          disabled={settings.goal === 0}
          onChange={(event) => change({ goalReminder: event.target.checked })}
        />
        <span>
          {t('reminderGoalToggle')}
          <small>{t('reminderGoalRule')}</small>
        </span>
      </label>

      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.reviewReminder}
          onChange={(event) => change({ reviewReminder: event.target.checked })}
        />
        <span>
          {t('reminderReviewToggle')}
          <small>{t('reminderReviewRule')}</small>
        </span>
      </label>

      {settings.reviewReminder && (
        <ChoiceChips
          compact
          label={t('reminderReviewTime')}
          name="review-time"
          value={settings.reviewTime}
          options={REVIEW_TIMES.map((time) => ({ value: time, label: time }))}
          onChange={(reviewTime) => change({ reviewTime })}
        />
      )}

      <p className="tiny-note" role="status">
        {permission === 'denied'
          ? t('reminderDenied')
          : next && (settings.goalReminder || settings.reviewReminder)
            ? t('reminderNext', { when: timeFormat.format(next.at), kind: t(next.kind === 'review' ? 'reminderKindReview' : 'reminderKindGoal') })
            : t('reminderNone')}
      </p>
      {!isNative && <p className="tiny-note">{t('reminderWebNote')}</p>}
    </section>
  )
}
