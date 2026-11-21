import { describe, expect, it } from 'vitest'
import { applyFixes } from './packFixes'

const items = [
  { id: 'b001', text: 'know', meaning: '알다', example: 'I know.', exampleKo: '알아.', tatoeba: 1288 },
  { id: 'b002', text: 'tired', meaning: '피곤한', example: "I'm tired.", exampleKo: '피곤해.', tatoeba: 77 },
  { id: 'b003', text: 'kill', meaning: '죽이다', example: 'x', exampleKo: 'x' },
]

describe('꾸러미 고침 덮어쓰기', () => {
  it('고침이 없으면 그대로 돌려준다', () => {
    expect(applyFixes(items, [])).toBe(items)
  })

  it('고친 칸만 바꾸고, 빈 칸(null)은 원래 값을 쓰며, 숨긴 항목은 뺀다', () => {
    const fixed = applyFixes(items, [
      { item_id: 'b001', meaning: '알다, 알고 있다', example: null, example_ko: '', tip: null, hidden: false },
      { item_id: 'b003', hidden: true },
    ])
    expect(fixed.map((item) => item.id)).toEqual(['b001', 'b002'])
    expect(fixed[0]).toMatchObject({ meaning: '알다, 알고 있다', example: 'I know.', exampleKo: '알아.', tatoeba: 1288, fixed: true })
    expect(fixed[1]).toBe(items[1])
  })

  it('예문을 바꾸면 Tatoeba 출처 번호를 뗀다', () => {
    const [fixed] = applyFixes([items[1]], [{ item_id: 'b002', example: "I'm so tired today.", example_ko: '오늘 너무 피곤해.', hidden: false }])
    expect(fixed).toMatchObject({ example: "I'm so tired today.", exampleKo: '오늘 너무 피곤해.' })
    expect(fixed).not.toHaveProperty('tatoeba')
  })
})
