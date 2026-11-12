// 간격 반복 복습. 맞히면 상자를 하나 올리고 더 오래 뒤에 다시 묻는다.
// 틀리면 첫 상자로 돌아가 오늘 다시 묻는다.
export const INTERVAL_DAYS = [0, 1, 2, 4, 7, 15, 30]
const LAST_BOX = INTERVAL_DAYS.length - 1

export function isDue(item, now = new Date()) {
  if (!item.dueAt) return true
  return Date.parse(item.dueAt) <= now.getTime()
}

export function dueItems(items, now = new Date()) {
  return items.filter((item) => isDue(item, now))
}

export function schedule(item, correct, now = new Date()) {
  const box = correct ? Math.min((item.box ?? 0) + 1, LAST_BOX) : 0
  const due = new Date(now)
  due.setDate(due.getDate() + INTERVAL_DAYS[box])
  return { box, dueAt: due.toISOString(), lastReviewedAt: now.toISOString() }
}
