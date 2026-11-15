// Pro 시연판의 학습 통계. 모두 사용자가 가진 기록에서만 계산한다(서버로 보내지 않음).
import { activityDays, dayKey, streak } from './activity'
import { INTERVAL_DAYS, isDue } from './review'

const TYPES = ['word', 'expression', 'chat', 'journal']
const RECENT_DAYS = 28
const UPCOMING_DAYS = 7

function startOfDay(date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function shift(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * @returns {{
 *   total: number, byType: Record<string, number>, thisMonth: number, streakDays: number,
 *   reviewed: number, recent: Array<{ date: Date, count: number }>,
 *   stages: Array<{ box: number | null, count: number }>, upcoming: Array<{ date: Date, count: number }>
 * }}
 */
export function computeStats(records, now = new Date()) {
  const all = TYPES.flatMap((type) => records[type] ?? [])
  const byType = Object.fromEntries(TYPES.map((type) => [type, (records[type] ?? []).length]))
  const today = startOfDay(now)

  const thisMonth = all.filter((item) => {
    const created = new Date(item.createdAt)
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
  }).length

  // 최근 4주, 날마다 새로 모은 기록 수
  const perDay = new Map()
  all.forEach((item) => {
    const key = dayKey(item.createdAt)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  })
  const recent = Array.from({ length: RECENT_DAYS }, (_, index) => {
    const date = shift(today, index - (RECENT_DAYS - 1))
    return { date, count: perDay.get(dayKey(date)) ?? 0 }
  })

  // 복습하는 기록(단어·표현)의 기억 단계. 아직 복습하지 않은 것은 box: null
  const reviewable = [...(records.word ?? []), ...(records.expression ?? [])]
  const stages = [null, ...INTERVAL_DAYS.map((_, box) => box)].map((box) => ({
    box,
    count: reviewable.filter((item) => (box === null ? item.box == null : item.box === box)).length,
  }))

  // 앞으로 7일 동안 날마다 복습할 수. 이미 지난 것은 오늘에 더한다.
  const upcoming = Array.from({ length: UPCOMING_DAYS }, (_, index) => ({ date: shift(today, index), count: 0 }))
  reviewable.forEach((item) => {
    if (isDue(item, now)) {
      upcoming[0].count += 1
      return
    }
    const offset = Math.round((startOfDay(item.dueAt) - today) / 86400000)
    if (offset >= 0 && offset < UPCOMING_DAYS) upcoming[offset].count += 1
  })

  return {
    total: all.length,
    byType,
    thisMonth,
    streakDays: streak(activityDays(records), now),
    reviewed: reviewable.filter((item) => item.lastReviewedAt).length,
    recent,
    stages,
    upcoming,
  }
}
