import { describe, expect, it } from 'vitest'
import { fromLegacy } from './legacy'

const ID = 1731400000000
const CREATED = new Date(ID).toISOString()

describe('fromLegacy', () => {
  it('원본 단어와 표현을 바꾼다', () => {
    expect(fromLegacy('word', { id: ID, word: 'thoughtful', meaning: '사려 깊은', example: 'A gift.' }))
      .toMatchObject({ createdAt: CREATED, text: 'thoughtful', meaning: '사려 깊은', example: 'A gift.' })
    expect(fromLegacy('expression', { id: ID, expression: 'Me too!', meaning: '나도!' }))
      .toMatchObject({ text: 'Me too!', meaning: '나도!', example: '' })
  })

  it('원본 대화의 한국어 카테고리와 예전 메모 이름을 바꾼다', () => {
    const chat = fromLegacy('chat', {
      id: ID,
      category: '약속과 계획',
      situation: '약속',
      message: 'See you',
      meaning: '또 봐',
      explanation: '옛 이름의 메모',
    })
    expect(chat).toMatchObject({ category: 'plans', note: '옛 이름의 메모' })
    expect(fromLegacy('chat', { id: ID, category: '모르는 값' }).category).toBe('other')
  })

  it('원본 일기의 nativeText와 note를 바꾼다', () => {
    expect(fromLegacy('journal', { id: ID, nativeText: '일기', translation: 'diary', note: '메모', date: '2026. 11. 12.' }))
      .toMatchObject({ native: '일기', translation: 'diary', memo: '메모', aiFeedback: '' })
  })

  it('지금 형식은 그대로 두고, 읽을 수 없는 값은 버린다', () => {
    const current = { id: 'a', createdAt: CREATED, text: 'hi', meaning: '안녕' }
    expect(fromLegacy('word', current)).toBe(current)
    expect(fromLegacy('word', null)).toBeNull()
    expect(fromLegacy('word', 3)).toBeNull()
    expect(fromLegacy('unknown', { id: ID })).toBeNull()
  })

  it('id가 시각이 아니면 지금 시각을 쓰고, 문자열이 아닌 값은 빈 칸으로 둔다', () => {
    const item = fromLegacy('word', { id: 'abc', word: 42 })
    expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false)
    expect(item.text).toBe('')
  })
})
