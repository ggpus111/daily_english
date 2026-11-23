import { useEffect, useState } from 'react'
import { useApp } from '../../context'
import { useReminderSettings } from '../../hooks/useReminderSettings'
import { setCoupleNotify } from '../../lib/couple'
import { notificationPermission, requestNotificationPermission, sendTestNotification } from '../../lib/notifications'
import { isNative } from '../../lib/platform'
import { REVIEW_TIMES, planReminders } from '../../lib/reminders'
import { supabase } from '../../lib/supabase'
import { ensureWebPush } from '../../lib/webPush'
import ChoiceRow from './ChoiceRow'
import Switch from '../Switch'

const MESSAGES = { granted: 'notifyOn', denied: 'notifyBlocked', prompt: 'notifyOff', unsupported: 'notifyUnsupported' }

/** 설정의 "알림": 알림 허용 상태, 알림 종류별 스위치, 시험 알림. 켤 때만 알림 권한을 묻는다. */
export default function NotificationSection() {
  const { t, notify, user, records, nativeLang } = useApp()
  const [settings, update] = useReminderSettings()
  const [permission, setPermission] = useState('prompt')
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const timeFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  const next = planReminders(records, settings)[0]
  const signedIn = Boolean(supabase && user)

  useEffect(() => {
    notificationPermission()
      .then(setPermission)
      .catch(() => setPermission('unsupported'))
  }, [])

  // 알림을 켜기 전에 권한이 있는지 본다. 없으면 이때 묻고, 거절하면 켜지 않는다.
  async function ensurePermission() {
    if (permission === 'granted') return true
    const result = await requestNotificationPermission().catch(() => 'denied')
    setPermission(result)
    if (result === 'granted') return true
    notify(t(result === 'unsupported' ? 'reminderUnsupported' : 'reminderDenied'))
    return false
  }

  async function toggle(patch) {
    if (Object.values(patch).includes(true) && !(await ensurePermission())) return
    update(patch)
  }

  async function toggleCouple(on) {
    if (on && !(await ensurePermission())) return
    try {
      // 웹은 브라우저를 닫아도 오도록 푸시 주소를 서버에 등록한다. 앱은 앱을 열 때 알려 준다(useCoupleInbox).
      if (on && !isNative) await ensureWebPush()
      const result = await setCoupleNotify(on, nativeLang)
      // 아직 짝이 없으면 서버에는 저장할 줄이 없다. 설정은 이 기기에 남겨 두었다가 짝이 되면 다시 켜면 된다.
      if (result.error) throw new Error(result.error.message)
    } catch {
      notify(t('notifyCoupleError'))
      return
    }
    update({ couple: on })
  }

  async function test() {
    try {
      const sent = await sendTestNotification(t)
      if (!sent) {
        await ensurePermission()
        return
      }
      notify(t('notifyTestSent'))
    } catch {
      notify(t('notifyTestFail'))
    }
  }

  const goalOn = settings.goalReminder && settings.goal > 0
  const anyOn = goalOn || settings.reviewReminder

  return (
    <section className="s-section" aria-labelledby="settings-notify">
      <h2 id="settings-notify">{t('reminderTitle')}</h2>
      <p className="muted">{t('reminderBody')}</p>

      <div className="permission-row" role="status">
        <span>
          {t('notifyStatus')}: <strong>{t(MESSAGES[permission] ?? 'notifyOff')}</strong>
        </span>
        {permission === 'prompt' && (
          <button className="soft-button" onClick={ensurePermission}>
            {t('notifyAllow')}
          </button>
        )}
        {permission === 'granted' && (
          <button className="soft-button" onClick={test}>
            {t('notifyTest')}
          </button>
        )}
      </div>
      {permission === 'denied' && <p className="tiny-note">{t('reminderDenied')}</p>}

      <div className="s-list">
      <Switch
        label={t('reminderGoalToggle')}
        description={settings.goal === 0 ? t('notifyNeedGoal') : t('reminderGoalRule')}
        checked={goalOn}
        disabled={settings.goal === 0}
        onChange={(on) => toggle({ goalReminder: on })}
      />
      <Switch
        label={t('reminderReviewToggle')}
        description={t('reminderReviewRule')}
        checked={settings.reviewReminder}
        onChange={(on) => toggle({ reviewReminder: on })}
      />
      {settings.reviewReminder && (
        <ChoiceRow
          label={t('reminderReviewTime')}
          name="review-time"
          value={settings.reviewTime}
          options={REVIEW_TIMES.map((time) => ({ value: time, label: time }))}
          onChange={(reviewTime) => update({ reviewTime })}
        />
      )}
      <Switch
        label={t('notifyCouple')}
        description={signedIn ? t(isNative ? 'notifyCoupleApp' : 'notifyCoupleWeb') : t('notifyCoupleLogin')}
        checked={settings.couple && signedIn}
        disabled={!signedIn}
        onChange={toggleCouple}
      />
      </div>

      <p className="tiny-note" role="status">
        {anyOn && next
          ? t('reminderNext', {
              when: timeFormat.format(next.at),
              kind: t(next.kind === 'review' ? 'reminderKindReview' : 'reminderKindGoal'),
            })
          : t('reminderNone')}
      </p>
      {!isNative && <p className="tiny-note">{t(signedIn ? 'reminderWebNoteSignedIn' : 'reminderWebNote')}</p>}
    </section>
  )
}
