// 알림 보내기: 안드로이드 앱은 휴대폰 알림(로컬 알림)으로 미리 예약하고,
// 웹은 이 탭(또는 설치한 웹앱)이 열려 있는 동안 브라우저 알림으로 보낸다.
// 웹에서 브라우저를 닫아도 오게 하려면 푸시 서버가 따로 필요하다(지금은 없음, 운영비 0원 원칙).
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from './platform'
import { planReminders, reminderText } from './reminders'

const WEB_WINDOW_MS = 24 * 60 * 60 * 1000
let webTimers = []

/** 'granted' | 'denied' | 'prompt' | 'unsupported' */
export async function notificationPermission() {
  if (isNative) return (await LocalNotifications.checkPermissions()).display
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function requestNotificationPermission() {
  if (isNative) return (await LocalNotifications.requestPermissions()).display
  if (typeof Notification === 'undefined') return 'unsupported'
  const result = await Notification.requestPermission()
  return result === 'default' ? 'prompt' : result
}

async function showWebNotification(item, t) {
  const { title, body } = reminderText(item, t)
  const options = { body, icon: '/icon-192.png', tag: `daily-english-${item.kind}` }
  const registration = await navigator.serviceWorker?.getRegistration?.()
  if (registration) await registration.showNotification(title, options)
  else new Notification(title, options)
}

/** 지금 기록과 설정으로 알림을 다시 예약한다. 앞서 예약한 것은 모두 지우고 새로 넣는다. */
export async function scheduleReminders(records, settings, t, now = new Date()) {
  const plan = planReminders(records, settings, now)

  if (isNative) {
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) })
    if (!plan.length || (await notificationPermission()) !== 'granted') return plan
    await LocalNotifications.schedule({
      notifications: plan.map((item) => ({
        id: item.id,
        ...reminderText(item, t),
        schedule: { at: item.at, allowWhileIdle: true },
        extra: { kind: item.kind },
      })),
    })
    return plan
  }

  webTimers.forEach(clearTimeout)
  webTimers = []
  if ((await notificationPermission()) !== 'granted') return plan
  for (const item of plan) {
    const delay = item.at.getTime() - now.getTime()
    if (delay > 0 && delay <= WEB_WINDOW_MS) {
      webTimers.push(setTimeout(() => showWebNotification(item, t).catch(() => {}), delay))
    }
  }
  return plan
}

/** 알림을 누르면 앱의 알맞은 화면으로 간다(안드로이드). 해제 함수를 돌려준다. */
export function onReminderTap(go) {
  if (!isNative) return undefined
  const listener = LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    go(notification.extra?.kind === 'review' ? 'words' : 'journal')
  })
  return () => {
    listener.then((handle) => handle.remove())
  }
}
