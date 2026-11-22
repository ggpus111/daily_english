// 알림 계획: 하루 목표 알림과 복습 알림을 언제, 무슨 말로 보낼지 정한다(보내는 일은 notifications.js).
//
// - 목표 알림: 하루 목표(기록 + 복습한 개수)를 아직 못 채웠으면 13시에 첫 알림, 그 뒤에도 못 채웠으면
//   1.5~2.5시간마다 다시 알린다. 21시가 지나면 보내지 않고, 하루 최대 5번. 목표를 채우면 그날 남은 알림은 없다.
// - 복습 알림: 정한 시간에 그때까지 복습할 단어·표현이 있으면 개수를 알린다.
// - 리뷰 분석에서 압박·죄책감은 불만 요인이라, 기본은 꺼 두고(직접 켬) 다그치지 않는 말투로 쓴다.
import { dayKey } from './activity'
import { local } from './storage'

export const REMINDER_KEY = 'reminders'
export const GOALS = [0, 3, 5, 10, 20]
export const REVIEW_TIMES = ['09:00', '12:00', '19:00', '21:00']
export const DEFAULT_SETTINGS = { goal: 5, goalReminder: false, reviewReminder: false, reviewTime: '19:00', couple: false }
/** 알림 설정이 바뀌었다는 신호(알림을 다시 예약하게 한다) */
export const REMINDERS_CHANGED = 'reminders-changed'

const FIRST_HOUR = 13
const LAST_HOUR = 21
const MIN_GAP = 90
const MAX_GAP = 150
const MAX_GOAL_ALERTS = 5
const PLAN_DAYS = 3

export function readSettings() {
  const saved = local.getJson(REMINDER_KEY)
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) }
}

export function saveSettings(settings) {
  local.set(REMINDER_KEY, JSON.stringify(settings))
}

/** 오늘 한 일: 오늘 만든 기록 수 + 오늘 복습한 단어·표현 수 */
export function todayProgress(records, now = new Date()) {
  const today = dayKey(now)
  const created = Object.values(records)
    .flat()
    .filter((item) => item.createdAt && dayKey(item.createdAt) === today).length
  const reviewed = [...records.word, ...records.expression].filter(
    (item) => item.lastReviewedAt && dayKey(item.lastReviewedAt) === today,
  ).length
  return created + reviewed
}

// 날짜마다 같은 간격이 나오도록 날짜로 정해지는 난수(테스트와 다시 계획할 때 시간이 흔들리지 않게)
function seeded(seed) {
  let value = seed % 2147483647 || 1
  return () => {
    value = (value * 48271) % 2147483647
    return value / 2147483647
  }
}

/** 그날 목표 알림 시각들: 13시, 이후 1.5~2.5시간 간격, 21시 전까지, 최대 5번 */
export function goalTimes(date) {
  const day = new Date(date)
  day.setHours(FIRST_HOUR, 0, 0, 0)
  const random = seeded(Number(dayKey(day).replace(/-/g, '')))
  const end = new Date(day)
  end.setHours(LAST_HOUR, 0, 0, 0)
  const times = []
  let at = day
  while (at <= end && times.length < MAX_GOAL_ALERTS) {
    times.push(new Date(at))
    const gap = MIN_GAP + Math.round(random() * (MAX_GAP - MIN_GAP))
    at = new Date(at.getTime() + gap * 60_000)
  }
  return times
}

function atTime(date, time) {
  const [hours, minutes] = time.split(':').map(Number)
  const value = new Date(date)
  value.setHours(hours, minutes, 0, 0)
  return value
}

const dueBy = (items, time) =>
  items.filter((item) => !item.dueAt || Date.parse(item.dueAt) <= time.getTime()).length

/**
 * 앞으로 보낼 알림 목록. 오늘은 지금 이후만, 내일부터는 아직 아무것도 안 한 것으로 보고 계획한다
 * (앱을 다시 열면 그때 다시 계획한다).
 * @returns {Array<{ id: number, kind: 'goal'|'review', at: Date, count: number }>}
 */
export function planReminders(records, settings, now = new Date()) {
  const plan = []
  const done = todayProgress(records, now)
  for (let offset = 0; offset < PLAN_DAYS; offset += 1) {
    const day = new Date(now)
    day.setDate(day.getDate() + offset)
    const dayNumber = Number(dayKey(day).replace(/-/g, '')) % 100000
    if (settings.goalReminder && settings.goal > 0) {
      const left = offset === 0 ? settings.goal - done : settings.goal
      if (left > 0) {
        goalTimes(day).forEach((at, slot) => {
          if (at > now) plan.push({ id: dayNumber * 10 + slot, kind: 'goal', at, count: left })
        })
      }
    }
    if (settings.reviewReminder) {
      const at = atTime(day, settings.reviewTime)
      const count = dueBy([...records.word, ...records.expression], at)
      if (at > now && count > 0) plan.push({ id: dayNumber * 10 + 9, kind: 'review', at, count })
    }
  }
  return plan.sort((a, b) => a.at - b.at)
}

/** 알림 문구. 다그치지 않고, 바로 할 수 있는 작은 일을 권한다. */
export function reminderText(item, t) {
  if (item.kind === 'review') return { title: t('reminderReviewTitle'), body: t('reminderReviewBody', { count: item.count }) }
  return { title: t('reminderGoalTitle'), body: t('reminderGoalBody', { count: item.count }) }
}
