import { describe, expect, it } from 'vitest'
import { moodsByDay, usedEntries, weeklyRecap } from './usage'

const entries = [
  { id: 'e1', text: 'hang out' },
  { id: 'w1', text: 'tired' },
  { id: 'w2', text: 'make' },
  { id: 'w3', text: 'Tired' },
  { id: 'w4', text: 'figure out' },
]

describe('일기에 쓴 내 표현 찾기', () => {
  it('문장에 나온 순서대로, 활용형까지, 같은 말은 한 번만 찾는다', () => {
    const used = usedEntries('I was so tired, so we hung out? No, we hang out and made dinner.', entries)
    expect(used.map((entry) => entry.text)).toEqual(['tired', 'hang out', 'make'])
  })

  it('빈 문장이나 없는 말이면 빈 목록', () => {
    expect(usedEntries('', entries)).toEqual([])
    expect(usedEntries('I went to school.', entries)).toEqual([])
  })
})

describe('이번 주 돌아보기', () => {
  const today = new Date('2026-11-15T20:00:00')
  const at = (day, hour = 9) => new Date(`2026-11-${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
  const records = {
    word: [
      { id: 'w1', text: 'tired', createdAt: at('14'), lastReviewedAt: at('15') },
      { id: 'w0', text: 'old', createdAt: at('01') },
    ],
    expression: [{ id: 'e1', text: 'hang out', createdAt: at('13') }],
    chat: [],
    // 최신순
    journal: [
      { id: 'j3', createdAt: at('15', 21), translation: 'I was tired.', mood: 'tired' },
      { id: 'j2', createdAt: at('15', 8), translation: 'Good morning.', mood: 'happy' },
      { id: 'j1', createdAt: at('12'), translation: 'We hang out at the park.', mood: 'not-a-mood' },
      { id: 'j0', createdAt: at('02'), translation: 'I was tired last week too.', mood: 'sad' },
    ],
  }

  it('날마다 그날 마지막으로 고른 기분을 쓴다', () => {
    const moods = moodsByDay(records.journal)
    expect(moods.get('2026-11-15')).toBe('tired')
    expect(moods.has('2026-11-12')).toBe(false)
    expect(moods.get('2026-11-02')).toBe('sad')
  })

  it('오늘 포함 7일의 새 기록, 복습, 일기에 쓴 내 표현, 기분을 모은다', () => {
    expect(weeklyRecap(records, today)).toEqual({
      newWords: 1,
      newExpressions: 1,
      journals: 3,
      reviewed: 1,
      used: ['hang out', 'tired'],
      moods: [
        { day: '2026-11-15', mood: 'happy' },
        { day: '2026-11-15', mood: 'tired' },
      ],
    })
  })
})
