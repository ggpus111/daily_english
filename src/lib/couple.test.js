import { describe, expect, it } from 'vitest'
import {
  MAX_FRIENDS,
  REACTIONS,
  buildPairs,
  canAddKind,
  todayStatus,
  coupleErrorKey,
  exchangeStreak,
  groupByDay,
  isValidCode,
  normalizeCode,
  reactionsBySentence,
  suggestionFor,
} from './couple'

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
    expect(coupleErrorKey({ message: 'too many attempts' })).toBe('coupleErrTooMany')
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

describe('reactionsBySentence', () => {
  it('문장마다 내 반응과 상대 반응을 나눠 담는다', () => {
    const map = reactionsBySentence(
      [
        { sentence_id: 1, user_id: 'me', kind: 'heart' },
        { sentence_id: 1, user_id: 'you', kind: 'funny' },
        { sentence_id: 2, user_id: 'you', kind: 'learned' },
      ],
      'me',
    )
    expect(map.get(1)).toEqual({ mine: 'heart', theirs: 'funny' })
    expect(map.get(2)).toEqual({ mine: null, theirs: 'learned' })
    expect(map.get(3)).toBeUndefined()
  })

  it('반응 종류는 서버 표와 같은 네 가지다', () => {
    expect(REACTIONS).toEqual(['heart', 'thanks', 'funny', 'learned'])
  })
})

describe('여러 상대(연인·친구)', () => {
  const members = [
    { couple_id: 'f1', user_id: ME, nickname: '나', joined_at: '2026-11-02' },
    { couple_id: 'f1', user_id: 'sam', nickname: 'Sam', joined_at: '2026-11-02' },
    { couple_id: 'p1', user_id: ME, nickname: '나', joined_at: '2026-11-05' },
    { couple_id: 'p1', user_id: 'alex', nickname: 'Alex', joined_at: '2026-11-05' },
    { couple_id: 'f2', user_id: ME, nickname: '나', joined_at: '2026-11-01' },
  ]
  const couples = [
    { id: 'f1', code: 'AAAAAA', kind: 'friend' },
    { id: 'p1', code: 'BBBBBB', kind: 'partner' },
    { id: 'f2', code: 'CCCCCC', kind: 'friend' },
  ]
  const sentences = [
    { id: 1, couple_id: 'p1', user_id: 'alex', day: '2026-11-22', body: 'hi' },
    { id: 2, couple_id: 'f1', user_id: ME, day: '2026-11-22', body: 'yo' },
  ]
  const reactions = [{ sentence_id: 1, user_id: ME, kind: 'heart' }]

  it('연인 짝을 먼저, 친구 짝은 먼저 맺은 순서로 묶고, 문장과 반응을 짝별로 나눈다', () => {
    const pairs = buildPairs({ members, couples, sentences, reactions }, ME)
    expect(pairs.map((pair) => pair.id)).toEqual(['p1', 'f2', 'f1'])
    expect(pairs[0].partner.nickname).toBe('Alex')
    expect(pairs[1].partner).toBeNull()
    expect(pairs[0].sentences.map((row) => row.id)).toEqual([1])
    expect(pairs[0].reactions).toHaveLength(1)
    expect(pairs[2].reactions).toHaveLength(0)
  })

  it('오늘 내가 보냈는지, 상대가 보냈는지 알려 준다', () => {
    const pairs = buildPairs({ members, couples, sentences }, ME)
    expect(todayStatus(pairs[0], ME, NOW)).toEqual({ sent: false, received: true })
    expect(todayStatus(pairs[2], ME, NOW)).toEqual({ sent: true, received: false })
  })

  it('연인은 한 명, 친구는 정해진 수까지만 더 맺을 수 있다', () => {
    const pairs = buildPairs({ members, couples }, ME)
    expect(canAddKind(pairs, 'partner')).toBe(false)
    expect(canAddKind(pairs, 'friend')).toBe(true)
    const full = Array.from({ length: MAX_FRIENDS }, (_, i) => ({ kind: 'friend', id: String(i) }))
    expect(canAddKind(full, 'friend')).toBe(false)
    expect(canAddKind([], 'partner')).toBe(true)
  })

  it('친구 수 초과와 내 번호 입력 오류를 문구 키로 바꾼다', () => {
    expect(coupleErrorKey({ message: 'too many friends' })).toBe('pairErrTooManyFriends')
    expect(coupleErrorKey({ message: 'own code' })).toBe('pairErrOwnCode')
  })
})
