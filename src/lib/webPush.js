// 웹 푸시: 브라우저를 닫아도 알림이 오게, 앱이 계획한 알림을 서버 대기열(push_queue)에 올린다.
// 실제로 보내는 일은 서버 함수(supabase/functions/send-reminders)가 10분마다 한다.
// 로그인했고, 브라우저가 푸시를 지원하고, VITE_VAPID_PUBLIC_KEY가 있을 때만 쓴다. 아니면 탭이 열려 있을 때만 알린다.
import { reminderText } from './reminders'
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

/** 알림을 누르면 열 화면 */
const urlFor = (kind) => (kind === 'review' ? '/#words' : '/#journal')

export function webPushAvailable() {
  return Boolean(
    supabase &&
      VAPID_PUBLIC_KEY &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window !== 'undefined' &&
      'PushManager' in window,
  )
}

/** VAPID 공개 키(base64url) → 브라우저가 받는 바이트 */
export function keyToBytes(base64url) {
  const padded = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

/** 알림 계획 → 대기열 행. 문구는 지금 고른 언어로 미리 만든다. */
export function toQueueRows(plan, t) {
  return plan.map((item) => {
    const { title, body } = reminderText(item, t)
    return { send_at: item.at.toISOString(), kind: item.kind, title: title.slice(0, 80), body: body.slice(0, 200), url: urlFor(item.kind) }
  })
}

async function ensureSubscription() {
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }))
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' })
  if (error) throw error
}

/** 로그아웃할 때: 이 계정의 안 보낸 알림과 이 브라우저의 푸시 주소를 지우고 구독을 끊는다. */
export async function stopWebPush() {
  if (!webPushAvailable()) return
  await supabase.from('push_queue').delete().gte('send_at', new Date().toISOString())
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/**
 * 서버 대기열을 새 계획으로 바꾼다. 앞으로 보낼 줄은 지우고 다시 넣는다(목표를 채우면 남은 알림이 빠진다).
 * plan이 비었으면(알림을 껐거나 보낼 것이 없음) 지우기만 한다.
 */
export async function syncWebPush(plan, t, now = new Date()) {
  if (plan.length) await ensureSubscription()
  const { error: deleteError } = await supabase.from('push_queue').delete().gte('send_at', now.toISOString())
  if (deleteError) throw deleteError
  if (!plan.length) return
  const { error } = await supabase.from('push_queue').insert(toQueueRows(plan, t))
  if (error) throw error
}
