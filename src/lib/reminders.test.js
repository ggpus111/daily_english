import { describe, expect, it } from 'vitest'
import { goalTimes, planReminders, todayProgress } from './reminders'

const empty = () => ({ word: [], expression: [], chat: [], journal: [] })
const at = (text) => new Date(`2026-11-19T${text}:00`)
const minutes = (a, b) => (b - a) / 60_000

describe('목표 알림 시각', () => {
  it('13시에 시작해 1.5~2.5시간 간격으로, 21시 전까지 최대 5번', () => {
    const times = goalTimes(at('08:00'))
    expect(times[0].getHours()).toBe(13)
    expect(times[0].getMinutes()).toBe(0)
    expect(times.length).toBeGreaterThanOrEqual(3)
    expect(times.length).toBeLessThanOrEqual(5)
    for (let i = 1; i < times.length; i += 1) {
      const gap = minutes(times[i - 1], times[i])
      expect(gap).toBeGreaterThanOrEqual(90)
      expect(gap).toBeLessThanOrEqual(150)
    }
    expect(times.at(-1) <= at('21:00')).toBe(true)
  })

  it('같은 날은 언제 다시 계획해도 같은 시각', () => {
    expect(goalTimes(at('08:00')).map(Number)).toEqual(goalTimes(at('15:30')).map(Number))
  })
})

describe('알림 계획', () => {
  const settings = { goal: 3, goalReminder: true, reviewReminder: true, reviewTime: '19:00' }

  it('목표를 못 채웠으면 오늘 남은 시각마다 남은 개수를 알린다', () => {
    const records = { ...empty(), word: [{ id: 'w1', createdAt: at('09:00').toISOString(), dueAt: at('10:00').toISOString() }] }
    const plan = planReminders(records, settings, at('14:00'))
    const today = plan.filter((item) => item.kind === 'goal' && item.at.getDate() === 19)
    expect(today.length).toBeGreaterThan(0)
    expect(today.every((item) => item.at > at('14:00') && item.count === 2)).toBe(true)
  })

  it('목표를 채우면 오늘 목표 알림은 없고, 내일 것은 남는다', () => {
    const now = at('14:00')
    const records = {
      ...empty(),
      word: [1, 2].map((n) => ({ id: `w${n}`, createdAt: at('09:00').toISOString() })),
      journal: [{ id: 'j1', createdAt: at('12:00').toISOString() }],
    }
    expect(todayProgress(records, now)).toBe(3)
    const plan = planReminders(records, settings, now)
    expect(plan.some((item) => item.kind === 'goal' && item.at.getDate() === 19)).toBe(false)
    expect(plan.some((item) => item.kind === 'goal' && item.at.getDate() === 20)).toBe(true)
  })

  it('복습 알림은 그 시각까지 복습할 게 있을 때만', () => {
    const due = { ...empty(), expression: [{ id: 'e1', createdAt: at('09:00').toISOString(), dueAt: at('18:00').toISOString() }] }
    const notDue = { ...empty(), expression: [{ id: 'e1', createdAt: at('09:00').toISOString(), dueAt: '2026-12-30T00:00:00Z' }] }
    const reviewOnly = { ...settings, goalReminder: false }
    expect(planReminders(due, reviewOnly, at('14:00'))[0]).toMatchObject({ kind: 'review', count: 1 })
    expect(planReminders(notDue, reviewOnly, at('14:00'))).toEqual([])
  })

  it('알림을 모두 끄면 계획이 없고, 알림 id는 겹치지 않는다', () => {
    expect(planReminders(empty(), { ...settings, goalReminder: false, reviewReminder: false }, at('08:00'))).toEqual([])
    const plan = planReminders(empty(), settings, at('08:00'))
    expect(new Set(plan.map((item) => item.id)).size).toBe(plan.length)
  })
})
