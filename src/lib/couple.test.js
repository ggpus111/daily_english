import { describe, expect, it } from 'vitest'
import { coupleErrorKey, exchangeStreak, groupByDay, isValidCode, normalizeCode, suggestionFor } from './couple'

const ME = 'me'
const NOW = new Date(2026, 10, 22, 12)
const row = (user_id, day, body = 'hi') => ({ id: Math.random(), user_id, day, body, lang: 'en' })

describe('초대 번호', () => {
  it('대문자로 바꾸고 헷갈리는 글자와 기호는 뺀다', () => {
    expect(normalizeCode(' ab-c0o1i2 34 ')).toBe('ABC234')
    expect(normalizeCode(undefined)).toBe('')
  })

  it('6자리가 다 찼을 때만 맞는 번호다', () => {
    expect(isValidCode('abc23')).toBe(false)
    expect(isValidCode('abc234')).toBe(true)
    expect(isValidCode('abc234xyz')).toBe(true)
  })

  it('서버 오류를 알아듣기 쉬운 문구 키로 바꾼다', () => {
    expect(coupleErrorKey({ message: 'invalid code' })).toBe('coupleErrCode')
    expect(coupleErrorKey({ message: 'couple full' })).toBe('coupleErrFull')
    expect(coupleErrorKey({ message: 'already paired' })).toBe('coupleErrPaired')
    expect(coupleErrorKey({ message: 'boom' })).toBeNull()
  })
})

describe('오늘의 한 문장 제안', () => {
  const data = {
    items: [
      { id: 'a', group: 'love', text: 'I miss you.' },
      { id: 'b', group: 'daily', text: 'Not a talk pack.' },
      { id: 'c', group: 'miss', text: 'Thinking of you.' },
    ],
  }

  it('연인·친구 대화 꾸러미에서만 고르고, 같은 날엔 같은 문장이다', () => {
    const pick = suggestionFor(data, NOW)
    expect(['a', 'c']).toContain(pick.id)
    expect(suggestionFor(data, new Date(2026, 10, 22, 23))).toEqual(pick)
  })

  it('꾸러미가 없으면 null', () => {
    expect(suggestionFor(null, NOW)).toBeNull()
    expect(suggestionFor({ items: [data.items[1]] }, NOW)).toBeNull()
  })
})

describe('날짜별로 묶기', () => {
  it('오늘은 비어 있어도 맨 위에 두고, 내 문장과 연인 문장을 나눈다', () => {
    const groups = groupByDay([row('her', '2026-11-20'), row(ME, '2026-11-20'), row(ME, '2026-11-21')], ME, NOW)
    expect(groups.map((group) => group.day)).toEqual(['2026-11-22', '2026-11-21', '2026-11-20'])
    expect(groups[0].mine).toBeNull()
    expect(groups[2].mine.user_id).toBe(ME)
    expect(groups[2].partner.user_id).toBe('her')
  })

  it('둘 다 보낸 날이 이어진 횟수를 센다(오늘 아직이면 어제부터)', () => {
    const both = (day) => [row(ME, day), row('her', day)]
    const groups = groupByDay([...both('2026-11-21'), ...both('2026-11-20'), row(ME, '2026-11-18')], ME, NOW)
    expect(exchangeStreak(groups, NOW)).toBe(2)
    const todayDone = groupByDay([...both('2026-11-22'), ...both('2026-11-21')], ME, NOW)
    expect(exchangeStreak(todayDone, NOW)).toBe(2)
    expect(exchangeStreak(groupByDay([row(ME, '2026-11-22')], ME, NOW), NOW)).toBe(0)
  })
})
