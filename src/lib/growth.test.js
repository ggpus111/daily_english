import { describe, expect, it } from 'vitest'
import { cleanColors, DEFAULT_DANI, growthPoints, growthState, LEVELS, levelOf, sevenDayRuns } from './growth'

const empty = { word: [], expression: [], chat: [], journal: [], grammar: [] }
const at = (day, hour = 10) => new Date(2026, 10, day, hour).toISOString()

describe('growthPoints', () => {
  it('counts saved items, correct reviews and journals', () => {
    const records = {
      ...empty,
      word: [{ createdAt: at(1), reviews: 3, misses: 1 }, { createdAt: at(1) }],
      expression: [{ createdAt: at(1), reviews: 1, misses: 0 }],
      grammar: [{ createdAt: at(1), reviews: 2, misses: 5 }],
      chat: [{ createdAt: at(1) }],
      journal: [{ createdAt: at(1) }, { createdAt: at(3) }],
    }
    const result = growthPoints(records)
    expect(result).toMatchObject({ saved: 5, correct: 3, journals: 2, corrected: 0, missions: 0, streaks: 0 })
    expect(result.points).toBe(5 + 3 + 6)
  })

  it('adds 2 points for each journal corrected by AI', () => {
    const records = { ...empty, journal: [{ createdAt: at(1), aiFeedback: '## 고친 문장' }, { createdAt: at(2), aiFeedback: ' ' }] }
    expect(growthPoints(records)).toMatchObject({ corrected: 1, points: 2 * 3 + 2 })
  })

  it('adds 3 points once per day when the journal uses that day’s expression', () => {
    const records = {
      ...empty,
      journal: [
        { createdAt: at(5, 9), translation: "I'm down for it, let's go." },
        { createdAt: at(5, 20), translation: "I'm down for it again." },
        { createdAt: at(6), translation: 'Nothing special today.' },
      ],
    }
    const expressionFor = () => "I'm down for it."
    expect(growthPoints(records, { expressionFor })).toMatchObject({ missions: 1, points: 3 * 3 + 3 })
    expect(growthPoints(records).missions).toBe(0)
  })

  it('adds 10 points for every 7 days in a row', () => {
    const word = Array.from({ length: 15 }, (_, index) => ({ createdAt: at(1 + index) }))
    expect(growthPoints({ ...empty, word })).toMatchObject({ saved: 15, streaks: 2, points: 15 + 20 })
  })

  it('works with no records', () => {
    expect(growthPoints(empty).points).toBe(0)
    expect(growthPoints({}).points).toBe(0)
  })
})

describe('sevenDayRuns', () => {
  it('restarts counting after a missed day', () => {
    const days = new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-08', '2026-11-09'])
    expect(sevenDayRuns(days)).toBe(0)
    days.add('2026-11-07')
    expect(sevenDayRuns(days)).toBe(1)
  })
})

describe('levelOf and growthState', () => {
  it('picks the highest level whose minimum is reached', () => {
    expect(levelOf(0)).toBe(0)
    expect(levelOf(99)).toBe(0)
    expect(levelOf(100)).toBe(1)
    expect(levelOf(9999)).toBe(3)
    expect(levelOf(10_000)).toBe(LEVELS.length - 1)
  })

  it('reports points left and progress to the next level', () => {
    expect(growthState(250)).toEqual({ level: 1, next: 2, toNext: 550, progress: (250 - 100) / 700 })
  })

  it('never goes below the best level reached', () => {
    const state = growthState(10, 2)
    expect(state.level).toBe(2)
    expect(state.progress).toBe(0)
    expect(state.toNext).toBe(2990)
  })

  it('stops at the last level', () => {
    expect(growthState(12_000)).toEqual({ level: 4, next: null, toNext: 0, progress: 1 })
    expect(growthState(0, 99).level).toBe(4)
  })
})

describe('cleanColors', () => {
  it('keeps allowed colors and drops anything else', () => {
    expect(cleanColors({ hair: '#f09bb0', top: 'red', item: '#f48b6c', extra: 1 })).toEqual({
      ...DEFAULT_DANI,
      hair: '#f09bb0',
      item: '#f48b6c',
    })
    expect(cleanColors(null)).toEqual(DEFAULT_DANI)
  })
})
