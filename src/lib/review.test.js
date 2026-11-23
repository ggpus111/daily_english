import { describe, expect, it } from 'vitest'
import { activityDays, dayKey, lastSevenDays, streak } from './activity'
import { INTERVAL_DAYS, SETTLED_BOX, dueItems, isDue, schedule, weakItems } from './review'

const NOW = new Date(2026, 10, 12, 9, 0)

describe('schedule', () => {
  it('맞히면 상자를 올리고 그만큼 뒤로 미룬다', () => {
    const next = schedule({ box: 1 }, true, NOW)
    expect(next.box).toBe(2)
    expect(dayKey(next.dueAt)).toBe(dayKey(new Date(2026, 10, 12 + INTERVAL_DAYS[2])))
    expect(next.lastReviewedAt).toBe(NOW.toISOString())
  })

  it('틀리면 첫 상자로 돌아가 오늘 다시 묻는다', () => {
    const next = schedule({ box: 5 }, false, NOW)
    expect(next.box).toBe(0)
    expect(isDue({ dueAt: next.dueAt }, NOW)).toBe(true)
  })

  it('복습한 횟수와 틀린 횟수를 쌓는다', () => {
    const first = schedule({}, false, NOW)
    expect(first).toMatchObject({ reviews: 1, misses: 1 })
    const second = schedule(first, true, NOW)
    expect(second).toMatchObject({ reviews: 2, misses: 1 })
  })

  it('마지막 상자에서 더 올라가지 않는다', () => {
    expect(schedule({ box: INTERVAL_DAYS.length - 1 }, true, NOW).box).toBe(INTERVAL_DAYS.length - 1)
  })

  it('한 번도 복습하지 않은 기록과 날짜가 지난 기록만 오늘 묻는다', () => {
    const items = [
      { id: 'new' },
      { id: 'past', dueAt: new Date(2026, 10, 11).toISOString() },
      { id: 'future', dueAt: new Date(2026, 10, 14).toISOString() },
    ]
    expect(dueItems(items, NOW).map((item) => item.id)).toEqual(['new', 'past'])
  })
})

describe('weakItems', () => {
  it('틀린 적이 있고 아직 익숙하지 않은 말만, 많이 틀린 순으로 돌려준다', () => {
    const items = [
      { id: 'never', box: 0 },
      { id: 'once', box: 1, misses: 1 },
      { id: 'often', box: 2, misses: 4 },
      { id: 'settled', box: SETTLED_BOX, misses: 6 },
    ]
    expect(weakItems(items).map((item) => item.id)).toEqual(['often', 'once'])
  })

  it('틀린 횟수가 같으면 상자가 낮은 말을 먼저', () => {
    const items = [
      { id: 'high', box: 3, misses: 2 },
      { id: 'low', box: 0, misses: 2 },
    ]
    expect(weakItems(items).map((item) => item.id)).toEqual(['low', 'high'])
  })
})

describe('activity', () => {
  const at = (day) => new Date(2026, 10, day, 12).toISOString()

  it('기록과 복습한 날을 모두 센다', () => {
    const days = activityDays({
      word: [{ createdAt: at(10), lastReviewedAt: at(11) }],
      journal: [{ createdAt: at(12) }],
    })
    expect([...days].sort()).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
  })

  it('오늘 안 했어도 어제까지 이어진 날수를 보여 준다', () => {
    const days = new Set(['2026-11-09', '2026-11-10', '2026-11-11'])
    expect(streak(days, NOW)).toBe(3)
    expect(streak(new Set(['2026-11-12', '2026-11-11']), NOW)).toBe(2)
    expect(streak(new Set(['2026-11-09']), NOW)).toBe(0)
  })

  it('최근 7일을 오늘이 마지막이 되게 돌려준다', () => {
    const week = lastSevenDays(new Set(['2026-11-12', '2026-11-06']), NOW)
    expect(week).toHaveLength(7)
    expect(week[0].active).toBe(true)
    expect(week[6]).toMatchObject({ active: true, isToday: true })
  })
})
