// 일기에 쓴 "내 표현" 찾기와 이번 주 돌아보기.
// 모은 말을 실제로 썼는지가 이 앱의 핵심 지표다(오늘 내가 쓴 말이 내 단어장이 된다).
import { dayKey } from './activity'
import { findPhrase } from './blank'
import { moodOf } from './moods'
import { normalizeText } from './text'


/** 문장에 들어 있는 내 단어·표현을 문장에 나온 순서대로, 같은 말은 한 번만 돌려준다. */
export function usedEntries(sentence, entries) {
  if (!String(sentence ?? '').trim()) return []
  const seen = new Set()
  const found = []
  for (const entry of entries) {
    const key = normalizeText(entry.text)
    if (!key || seen.has(key)) continue
    const match = findPhrase(entry.text, sentence)
    if (!match) continue
    seen.add(key)
    found.push({ entry, index: match.index })
  }
  return found.sort((a, b) => a.index - b.index).map((item) => item.entry)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 오늘을 포함한 지난 7일인지(기기 시간대 날짜 기준) */
function inLastWeek(value, today) {
  if (!value) return false
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const from = start.getTime() - 6 * DAY_MS
  const time = new Date(value).getTime()
  return time >= from && time < start.getTime() + DAY_MS
}

/** 날짜(YYYY-MM-DD)마다 그날 마지막으로 고른 기분 */
export function moodsByDay(journals) {
  const result = new Map()
  // 기록은 최신순이라 처음 만난 기분이 그날의 마지막 기분이다.
  for (const item of journals) {
    if (!moodOf(item.mood)) continue
    const key = dayKey(item.createdAt)
    if (!result.has(key)) result.set(key, item.mood)
  }
  return result
}

/** 이번 주(오늘 포함 7일) 돌아보기에 쓸 숫자와 낱말 */
export function weeklyRecap(records, today = new Date()) {
  const recent = (items) => items.filter((item) => inLastWeek(item.createdAt, today))
  const journals = recent(records.journal)
  const myEntries = [...records.expression, ...records.word]
  const used = []
  const seen = new Set()
  for (const journal of [...journals].reverse()) {
    for (const entry of usedEntries(journal.translation, myEntries)) {
      const key = normalizeText(entry.text)
      if (seen.has(key)) continue
      seen.add(key)
      used.push(entry.text)
    }
  }
  const moods = [...journals]
    .reverse()
    .filter((item) => moodOf(item.mood))
    .map((item) => ({ day: dayKey(item.createdAt), mood: item.mood }))
  const reviewed = [...records.word, ...records.expression].filter((item) => inLastWeek(item.lastReviewedAt, today))

  return {
    newWords: recent(records.word).length,
    newExpressions: recent(records.expression).length,
    journals: journals.length,
    reviewed: reviewed.length,
    used,
    moods,
  }
}
