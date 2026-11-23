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

// 복습한 횟수(reviews)와 틀린 횟수(misses)도 함께 쌓아, 자주 헷갈리는 말을 찾는 데 쓴다.
export function schedule(item, correct, now = new Date()) {
  const box = correct ? Math.min((item.box ?? 0) + 1, LAST_BOX) : 0
  const due = new Date(now)
  due.setDate(due.getDate() + INTERVAL_DAYS[box])
  return {
    box,
    dueAt: due.toISOString(),
    lastReviewedAt: now.toISOString(),
    reviews: (item.reviews ?? 0) + 1,
    misses: (item.misses ?? 0) + (correct ? 0 : 1),
  }
}

// 이 상자(7일 간격) 이상까지 올라오면 이제 익숙한 말로 보고 "헷갈리는 말"에서 뺀다.
export const SETTLED_BOX = 4

/** 한 번이라도 틀렸고 아직 익숙해지지 않은 말. 많이 틀린 순, 같으면 낮은 상자 순. */
export function weakItems(items) {
  return items
    .filter((item) => (item.misses ?? 0) > 0 && (item.box ?? 0) < SETTLED_BOX)
    .sort((a, b) => (b.misses ?? 0) - (a.misses ?? 0) || (a.box ?? 0) - (b.box ?? 0))
}
