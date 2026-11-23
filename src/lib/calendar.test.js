import { describe, expect, it } from 'vitest'
import { entriesByDay, monthGrid, shiftMonth } from './calendar'

describe('monthGrid', () => {
  it('일요일부터 7칸씩 나누고, 앞뒤 빈칸을 채운다', () => {
    // 2026년 11월 1일은 일요일, 30일까지
    const weeks = monthGrid(2026, 10)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0][0]).toEqual({ key: '2026-11-01', day: 1 })
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
    expect(weeks.at(-1).at(-1)).toBeNull()
  })

  it('1일이 주 중간이면 앞을 빈칸으로 둔다', () => {
    // 2026년 10월 1일은 목요일
    const weeks = monthGrid(2026, 9)
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0][4].key).toBe('2026-10-01')
  })
})

describe('entriesByDay', () => {
  it('같은 날 쓴 일기를 한데 모은다', () => {
    const at = (day, hour) => new Date(2026, 10, day, hour).toISOString()
    const byDay = entriesByDay([
      { id: 'a', createdAt: at(20, 9) },
      { id: 'b', createdAt: at(20, 22) },
      { id: 'c', createdAt: at(21, 8) },
    ])
    expect(byDay.get('2026-11-20').map((item) => item.id)).toEqual(['a', 'b'])
    expect(byDay.get('2026-11-21')).toHaveLength(1)
    expect(byDay.has('2026-11-22')).toBe(false)
  })
})

describe('shiftMonth', () => {
  it('해가 바뀌는 달도 넘긴다', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})
