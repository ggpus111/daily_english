// 일기 달력: 한 달을 주 단위 칸으로 나누고, 날짜별로 그날 쓴 일기를 모은다.
import { dayKey } from './activity'

/**
 * 그 달의 달력 칸. 첫 주 앞과 마지막 주 뒤는 빈칸(null)으로 채워 7칸씩 맞춘다(일요일 시작).
 * @returns {Array<Array<{ key: string, day: number } | null>>}
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= days; day += 1) cells.push({ key: dayKey(new Date(year, month, day)), day })
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** 날짜("2026-11-23")별로 그날 쓴 일기 목록. */
export function entriesByDay(items) {
  const byDay = new Map()
  for (const item of items) {
    const key = dayKey(item.createdAt)
    byDay.set(key, [...(byDay.get(key) ?? []), item])
  }
  return byDay
}

/** 한 달 앞뒤로 옮긴 { year, month }. */
export function shiftMonth({ year, month }, step) {
  const date = new Date(year, month + step, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}
