import { useCallback, useEffect, useMemo, useState } from 'react'
import { cleanColors, growthPoints, growthState } from '../lib/growth'
import { pickTodayExpression } from '../lib/purpose'
import { local } from '../lib/storage'
import { dayKey } from '../lib/activity'

const BEST_KEY = 'daniBest'
const COLORS_KEY = 'daniColors'

/**
 * 다니 키우기 상태: 점수, 단계, 꾸미기 색, 방금 오른 단계(축하 창).
 * expressionItems·purpose가 있으면 "오늘의 표현을 일기에 쓴 날"도 점수에 넣는다.
 */
export function useDani(records, { expressionItems, purpose } = {}) {
  const stats = useMemo(() => {
    let expressionFor
    if (expressionItems?.length) {
      // 그날 기분이 있는 가장 최근 일기의 기분으로 고른 표현(홈의 오늘의 표현과 같은 방식)
      const moods = new Map()
      for (const journal of records.journal ?? []) {
        const key = journal.createdAt && dayKey(journal.createdAt)
        if (key && journal.mood && !moods.has(key)) moods.set(key, journal.mood)
      }
      expressionFor = (date) => pickTodayExpression(expressionItems, { purpose, mood: moods.get(dayKey(date)) ?? '', now: date })?.text
    }
    return growthPoints(records, { expressionFor })
  }, [records, expressionItems, purpose])

  // 축하 창을 이미 본 가장 높은 단계. 처음 쓰는 기기에서는 비어 있다.
  const [seen, setSeen] = useState(() => {
    const stored = Number(local.get(BEST_KEY))
    return local.get(BEST_KEY) !== null && Number.isInteger(stored) && stored >= 0 ? stored : null
  })
  const state = growthState(stats.points, seen ?? 0)
  // 이미 기록이 있던 사람이 처음 열었을 때는 축하하지 않고 조용히 저장만 한다(다음부터 오를 때만 축하).
  const levelUp = seen !== null && state.level > seen ? state.level : null

  useEffect(() => {
    if (seen === null && stats.points > 0) local.set(BEST_KEY, String(state.level))
  }, [seen, stats.points, state.level])

  const closeLevelUp = useCallback(() => {
    local.set(BEST_KEY, String(state.level))
    setSeen(state.level)
  }, [state.level])

  const [colors, setColorsState] = useState(() => cleanColors(local.getJson(COLORS_KEY)))
  const setColors = useCallback((next) => {
    const clean = cleanColors(next)
    local.set(COLORS_KEY, JSON.stringify(clean))
    setColorsState(clean)
  }, [])

  return { stats, state, colors, setColors, levelUp, closeLevelUp }
}
