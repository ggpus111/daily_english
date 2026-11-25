import { describe, expect, it } from 'vitest'
import { normalizeQuery, searchPacks } from './packSearch'

const group = (id, items) => ({ id, title: { ko: id, en: id }, items })
const expressions = {
  groups: [
    group('slang', [
      { text: 'Lowkey', meaning: '은근히, 살짝' },
      { text: 'Highkey', meaning: '대놓고, 완전' },
      { text: "You're tripping.", meaning: '너 오버한다' },
      { text: 'No cap.', meaning: '진짜로, 거짓말 아니고' },
    ]),
    group('chat', [{ text: 'Lowkey', meaning: '은근히(중복)' }, { text: 'Catch you later.', meaning: '나중에 봐' }]),
  ],
}
const words = { groups: [group('beginner', [{ text: 'awkward', meaning: '어색한', example: 'That was awkward.' }])] }
const grammar = { groups: [group('time', [{ text: 'used to + 동사원형', meaning: '예전에는 ~하곤 했다', example: 'I used to play.' }])] }
const sources = [
  { kind: 'expressions', data: expressions },
  { kind: 'words', data: words },
  { kind: 'grammar', data: grammar },
]

describe('normalizeQuery', () => {
  it('대소문자, 아포스트로피, 문장 부호, 여러 칸 띄어쓰기를 무시한다', () => {
    expect(normalizeQuery('  You’re   TRIPPING! ')).toBe('youre tripping')
  })
})

describe('searchPacks', () => {
  it('친구가 보낸 슬랭을 대소문자와 상관없이 찾는다', () => {
    const { results } = searchPacks(sources, 'lowkey')
    expect(results[0].item.text).toBe('Lowkey')
    expect(results[0].group.id).toBe('slang')
  })

  it('같은 말이 여러 묶음에 있으면 한 번만 보여 준다', () => {
    const { results } = searchPacks(sources, 'lowkey')
    expect(results.filter((r) => r.item.text === 'Lowkey')).toHaveLength(1)
  })

  it('우리말 뜻으로도 찾는다', () => {
    const { results } = searchPacks(sources, '어색')
    expect(results.map((r) => r.item.text)).toEqual(['awkward'])
    expect(results[0].kind).toBe('words')
  })

  it('정확히 같은 말, 앞이 같은 말, 뜻이 같은 말 순서로 보여 준다', () => {
    const texts = searchPacks(sources, 'key').results.map((r) => r.item.text)
    expect(texts).toEqual(['Lowkey', 'Highkey'])
    const trip = searchPacks(sources, 'trip').results.map((r) => r.item.text)
    expect(trip[0]).toBe("You're tripping.")
  })

  it('문장 부호를 빼고 써도 찾는다', () => {
    expect(searchPacks(sources, 'no cap').results[0].item.text).toBe('No cap.')
    expect(searchPacks(sources, 'youre tripping').results[0].item.text).toBe("You're tripping.")
    expect(searchPacks(sources, "you're tripping").results[0].item.text).toBe("You're tripping.")
  })

  it('문법도 찾는다', () => {
    const { results } = searchPacks(sources, 'used to')
    expect(results[0].kind).toBe('grammar')
  })

  it('빈 검색어나 아직 안 불러온 꾸러미는 건너뛴다', () => {
    expect(searchPacks(sources, '   ')).toEqual({ results: [], total: 0 })
    expect(searchPacks([{ kind: 'words', data: null }], 'awkward')).toEqual({ results: [], total: 0 })
  })

  it('보여 줄 개수를 넘으면 전체 개수를 따로 알려 준다', () => {
    const { results, total } = searchPacks(sources, 'e', 2)
    expect(results).toHaveLength(2)
    expect(total).toBeGreaterThan(2)
  })
})
