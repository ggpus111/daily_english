import { describe, expect, it } from 'vitest'
import { computeStats } from './stats'

const now = new Date('2026-11-13T12:00:00')
const at = (days, hour = 9) => {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const records = {
  word: [
    { id: 'a', createdAt: at(0), text: 'a', meaning: '1' },
    { id: 'b', createdAt: at(-1), text: 'b', meaning: '2', box: 2, dueAt: at(2), lastReviewedAt: at(-1) },
    { id: 'c', createdAt: at(-40), text: 'c', meaning: '3', box: 0, dueAt: at(-1), lastReviewedAt: at(-2) },
  ],
  expression: [{ id: 'd', createdAt: at(-1), text: 'd', meaning: '4', box: 6, dueAt: at(30) }],
  chat: [],
  journal: [{ id: 'e', createdAt: at(-30), native: '일기' }],
}

describe('computeStats', () => {
  const stats = computeStats(records, now)

  it('종류별 개수와 이번 달 새 기록', () => {
    expect(stats.total).toBe(5)
    expect(stats.byType).toEqual({ word: 3, expression: 1, chat: 0, journal: 1 })
    expect(stats.thisMonth).toBe(3)
  })

  it('최근 4주는 오늘로 끝나고 날마다 센다', () => {
    expect(stats.recent).toHaveLength(28)
    expect(stats.recent.at(-1).count).toBe(1)
    expect(stats.recent.at(-2).count).toBe(2)
    expect(stats.recent.reduce((sum, day) => sum + day.count, 0)).toBe(3)
  })

  it('기억 단계: 복습 전, 상자 0~6', () => {
    const count = (box) => stats.stages.find((stage) => stage.box === box).count
    expect(stats.stages).toHaveLength(8)
    expect(count(null)).toBe(1)
    expect(count(0)).toBe(1)
    expect(count(2)).toBe(1)
    expect(count(6)).toBe(1)
  })

  it('앞으로 7일 복습 예정: 지난 것과 처음 것은 오늘에 더한다', () => {
    expect(stats.upcoming.map((day) => day.count)).toEqual([2, 0, 1, 0, 0, 0, 0])
    expect(stats.reviewed).toBe(2)
  })
})
