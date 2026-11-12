import { describe, expect, it } from 'vitest'
import { isCorrectAnswer, matchesQuery, shuffle } from './text'

describe('isCorrectAnswer', () => {
  it('대소문자, 끝 문장부호, 띄어쓰기를 무시한다', () => {
    expect(isCorrectAnswer(' Hang Out! ', 'hang out')).toBe(true)
    expect(isCorrectAnswer('어울려놀다', '어울려 놀다')).toBe(true)
  })

  it('여러 뜻 중 하나만 맞아도 정답이다', () => {
    expect(isCorrectAnswer('배려하는', '사려 깊은, 배려하는')).toBe(true)
    expect(isCorrectAnswer('사려 깊은', '사려 깊은 / 배려하는')).toBe(true)
  })

  it('틀린 답과 빈 답은 오답이다', () => {
    expect(isCorrectAnswer('친절한', '사려 깊은')).toBe(false)
    expect(isCorrectAnswer('   ', '사려 깊은')).toBe(false)
  })
})

describe('matchesQuery', () => {
  it('빈 검색어는 모두 통과한다', () => {
    expect(matchesQuery('  ', ['a'])).toBe(true)
  })

  it('대소문자를 무시하고 문자열이 아닌 값도 처리한다', () => {
    expect(matchesQuery('HANG', ['hang out', undefined])).toBe(true)
    expect(matchesQuery('12', [123, null])).toBe(true)
    expect(matchesQuery('zzz', ['hang out', undefined])).toBe(false)
  })
})

describe('shuffle', () => {
  it('원본을 바꾸지 않고 같은 항목을 돌려준다', () => {
    const items = [1, 2, 3, 4]
    const result = shuffle(items)
    expect(items).toEqual([1, 2, 3, 4])
    expect([...result].sort()).toEqual(items)
  })
})
