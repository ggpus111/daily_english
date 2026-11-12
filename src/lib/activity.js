// 기록하거나 복습한 날을 모아 이번 주 표시와 연속 기록일을 만든다.
// 하루 쉬어도 벌칙은 없다. 오늘 아직 안 했으면 어제까지 이어진 날수를 보여 준다.

export function dayKey(date) {
  const value = new Date(date)
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

export function activityDays(records) {
  const days = new Set()
  Object.values(records)
    .flat()
    .forEach((item) => {
      if (item.createdAt) days.add(dayKey(item.createdAt))
      if (item.lastReviewedAt) days.add(dayKey(item.lastReviewedAt))
    })
  return days
}

function shift(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function streak(days, today = new Date()) {
  let cursor = days.has(dayKey(today)) ? today : shift(today, -1)
  let count = 0
  while (days.has(dayKey(cursor))) {
    count += 1
    cursor = shift(cursor, -1)
  }
  return count
}

export function lastSevenDays(days, today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shift(today, index - 6)
    return { date, active: days.has(dayKey(date)), isToday: index === 6 }
  })
}
