import { activityDays, dayKey } from './activity'
import { findPhrase } from './blank'

// 다니 키우기: 모은 말, 맞힌 복습, 쓴 일기, AI 교정, 오늘의 표현 미션, 7일 연속 기록으로 점수를 세고 단계를 정한다.
// 기기 안 기록으로만 계산하므로 로그인하지 않아도 된다. 기록을 지워 점수가 줄어도
// 한 번 오른 단계는 내려가지 않게, 가장 높았던 단계를 따로 저장한다.

export const LEVELS = [
  { id: 'peek', min: 0 },
  { id: 'book', min: 100 },
  { id: 'chat', min: 800 },
  { id: 'cheer', min: 3000 },
  { id: 'doctor', min: 10000 },
]

// 하루에 일기 한 편, 말 5개, 복습 10개 정도면 20~25점: Lv.2는 4~5일, Lv.3은 한 달쯤, Lv.4는 넉 달쯤,
// 박사(10000점)는 1년 넘게 꾸준히 써야 닿는 최종 목표다.
export const POINTS = { saved: 1, correct: 1, journal: 3, corrected: 2, mission: 3, streak7: 10 }
const SAVED_TYPES = ['word', 'expression', 'grammar', 'chat']
const REVIEWED_TYPES = ['word', 'expression', 'grammar']

/**
 * 기록에서 점수와 그 내역을 센다.
 * expressionFor(date): 그날의 "오늘의 표현"(꾸러미에서 고른 말)을 돌려주는 함수. 없으면 미션 점수는 세지 않는다.
 */
export function growthPoints(records, { expressionFor } = {}) {
  const saved = SAVED_TYPES.reduce((sum, type) => sum + (records[type]?.length ?? 0), 0)
  const correct = REVIEWED_TYPES.reduce(
    (sum, type) =>
      sum + (records[type] ?? []).reduce((acc, item) => acc + Math.max(0, (item.reviews ?? 0) - (item.misses ?? 0)), 0),
    0,
  )
  const journalList = records.journal ?? []
  const journals = journalList.length
  const corrected = journalList.filter((item) => (item.aiFeedback ?? '').trim()).length
  const missions = expressionFor ? missionDays(journalList, expressionFor) : 0
  const streaks = sevenDayRuns(activityDays(records))
  const points =
    saved * POINTS.saved +
    correct * POINTS.correct +
    journals * POINTS.journal +
    corrected * POINTS.corrected +
    missions * POINTS.mission +
    streaks * POINTS.streak7
  return { saved, correct, journals, corrected, missions, streaks, points }
}

// 오늘의 표현을 그날 일기 번역에 쓴 날 수(하루에 한 번만 센다).
function missionDays(journals, expressionFor) {
  const days = new Set()
  for (const journal of journals) {
    if (!journal.createdAt || !journal.translation) continue
    const key = dayKey(journal.createdAt)
    if (days.has(key)) continue
    const phrase = expressionFor(new Date(journal.createdAt))
    if (phrase && findPhrase(phrase, journal.translation)) days.add(key)
  }
  return days.size
}

// 이어서 기록한 날을 7일마다 한 번씩 센다(14일 연속이면 2번).
export function sevenDayRuns(days) {
  const sorted = [...days].sort()
  let total = 0
  let run = 0
  let previous = null
  for (const key of sorted) {
    const date = new Date(`${key}T12:00:00`)
    const follows = previous && Math.round((date - previous) / 86_400_000) === 1
    run = follows ? run + 1 : 1
    if (run % 7 === 0) total += 1
    previous = date
  }
  return total
}

/** 점수로 정한 단계(0부터). */
export function levelOf(points) {
  let level = 0
  LEVELS.forEach((item, index) => {
    if (points >= item.min) level = index
  })
  return level
}

/** 화면에 보여 줄 단계: 점수로 정한 단계와 저장된 최고 단계 중 높은 것. */
export function growthState(points, bestLevel = 0) {
  const level = Math.max(levelOf(points), Math.min(Math.max(bestLevel, 0), LEVELS.length - 1))
  const next = LEVELS[level + 1] ?? null
  if (!next) return { level, next: null, toNext: 0, progress: 1 }
  const from = LEVELS[level].min
  const progress = Math.min(1, Math.max(0, (points - from) / (next.min - from)))
  return { level, next: level + 1, toNext: Math.max(0, next.min - points), progress }
}

// 꾸미기: 고를 수 있는 색만 받는다(저장된 값이 이상하면 기본값).
export const DANI_COLORS = {
  hair: ['#1b1b1b', '#6b4430', '#e7b55a', '#f09bb0', '#86b4ec'],
  top: ['#ffffff', '#f6c945', '#1b1b1b', '#f5b4c6', '#7fd1b9'],
  item: ['#1b1b1b', '#ffffff', '#f6c945', '#f48b6c'],
}
export const DEFAULT_DANI = { hair: '#1b1b1b', top: '#ffffff', item: '#1b1b1b' }
/** 헤드폰(소품)은 이 단계부터 고를 수 있다. */
export const ITEM_UNLOCK_LEVEL = 2

export function cleanColors(value) {
  const result = { ...DEFAULT_DANI }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(DANI_COLORS)) {
      if (DANI_COLORS[key].includes(value[key])) result[key] = value[key]
    }
  }
  return result
}
