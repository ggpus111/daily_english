import { beforeEach, describe, expect, it } from 'vitest'
import { loadPackData } from './packs'
import { MOODS } from './moods'
import {
  PURPOSE_KEY,
  moodFamily,
  pickTodayExpression,
  purposeItems,
  purposePack,
  purposeStarters,
  purposeWordLevel,
  readMissionTurn,
  readPurpose,
  saveMissionTurn,
  savePurpose,
} from './purpose'

const NOON = new Date(2026, 10, 24, 12)

describe('공부 목적 저장', () => {
  beforeEach(() => localStorage.clear())

  it('고른 적 없거나 모르는 값이면 일상으로 본다', () => {
    expect(readPurpose()).toBe('daily')
    localStorage.setItem(PURPOSE_KEY, 'travel')
    expect(readPurpose()).toBe('daily')
  })

  it('고른 목적을 남기고, 그 목적의 첫 꾸러미와 단어 단계를 알려 준다', () => {
    savePurpose('business')
    expect(readPurpose()).toBe('business')
    expect(purposePack('business')).toBe('work')
    expect(purposeWordLevel('study')).toBe('study')
    expect(purposeWordLevel('daily')).toBeNull()
  })
})

describe('기분 묶음', () => {
  it('모든 기분이 묶음 하나에 들어 있다', () => {
    for (const mood of MOODS) expect(moodFamily(mood.id), mood.id).toBeTruthy()
    expect(moodFamily('')).toBeNull()
  })
})

describe('목적·기분에 맞춘 오늘의 표현(영어 꾸러미)', async () => {
  const expressions = await loadPackData('expressions', 'en')
  const words = await loadPackData('words', 'en')

  it('비즈니스는 일·회사, 학업은 공부·학교, 일상은 그 둘을 뺀 꾸러미에서 고른다', () => {
    expect(purposeItems(expressions.items, 'business').every((item) => item.group === 'work')).toBe(true)
    expect(purposeItems(expressions.items, 'study').every((item) => item.group === 'study')).toBe(true)
    const daily = purposeItems(expressions.items, 'daily')
    expect(daily.some((item) => item.group === 'work' || item.group === 'study')).toBe(false)
    expect(daily.length).toBeGreaterThan(600)
  })

  it('기분을 고르면 대부분 그 기분 묶음의 표현이 나오고, 같은 날·기분·넘긴 횟수면 같은 표현이다', () => {
    for (const purpose of ['daily', 'business', 'study']) {
      for (const mood of ['happy', 'tired', 'worried', 'sad', 'calm']) {
        const picks = Array.from({ length: 30 }, (_, turn) =>
          pickTodayExpression(expressions.items, { purpose, mood, now: NOON, turn }),
        )
        const matching = picks.filter((item) => item.moods?.includes(moodFamily(mood)))
        expect(matching.length, `${purpose} ${mood}`).toBeGreaterThan(picks.length / 2)
        expect(new Set(picks.map((item) => item.id)).size, `${purpose} ${mood} 다양함`).toBeGreaterThan(4)
        expect(pickTodayExpression(expressions.items, { purpose, mood, now: NOON, turn: 3 })).toBe(picks[3])
      }
    }
  })

  it('"다른 표현"으로 넘긴 횟수를 그날·그 기분에만 기억한다', () => {
    localStorage.clear()
    saveMissionTurn('happy', 2, NOON)
    expect(readMissionTurn('happy', NOON)).toBe(2)
    expect(readMissionTurn('sad', NOON)).toBe(0)
    expect(readMissionTurn('happy', new Date(2026, 10, 25, 12))).toBe(0)
  })

  it('목적 안에 맞는 기분 표현이 없으면 그 목적의 표현 중에서 고른다', () => {
    for (let turn = 0; turn < 10; turn += 1) {
      const item = pickTodayExpression(expressions.items, { purpose: 'business', mood: 'loved', now: NOON, turn })
      expect(item.group).toBe('work')
    }
  })

  it('기분이 없으면 목적 안에서 날마다 하나를 고른다', () => {
    const item = pickTodayExpression(expressions.items, { purpose: 'study', now: NOON })
    expect(item.group).toBe('study')
    expect(pickTodayExpression([], { purpose: 'study' })).toBeNull()
  })

  it('첫 실행 추천: 비즈니스·학업은 그 목적의 표현과 단어, 일상은 기존 추천(null)', () => {
    const starters = purposeStarters(expressions.items, words.items, 'study')
    expect(starters.filter((item) => item.kind === 'expression')).toHaveLength(6)
    expect(starters.filter((item) => item.kind === 'word').every((item) => item.group === 'study')).toBe(true)
    expect(starters.filter((item) => item.kind === 'word')).toHaveLength(4)
    expect(purposeStarters(expressions.items, words.items, 'daily')).toBeNull()
  })
})
