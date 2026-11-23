import { describe, expect, it } from 'vitest'
import { buildChoices, canMakeChoices, choicePool, CHOICE_COUNT } from './choices'

const item = (id, meaning, extra = {}) => ({ id, text: `w${id}`, meaning, ...extra })
const same = (list) => [...list] // 섞지 않는 가짜 섞기(결과를 예측하려고)

describe('choicePool', () => {
  it('일기 교정에서 담은 표현과 뜻 없는 기록은 뺀다', () => {
    const pool = choicePool([item(1, '뜻'), item(2, '원래 쓴 말 · 이유', { source: 'journal' }), item(3, '  ')])
    expect(pool.map((entry) => entry.id)).toEqual([1])
  })
})

describe('canMakeChoices', () => {
  it('서로 다른 뜻이 보기 개수만큼 있어야 한다', () => {
    expect(canMakeChoices([item(1, 'a'), item(2, 'b'), item(3, 'c')])).toBe(false)
    expect(canMakeChoices([item(1, 'a'), item(2, 'b'), item(3, 'c'), item(4, 'd')])).toBe(true)
  })
  it('같은 뜻은 하나로 센다', () => {
    expect(canMakeChoices([item(1, 'a'), item(2, 'A.'), item(3, 'b'), item(4, 'c')])).toBe(false)
  })
})

describe('buildChoices', () => {
  const pool = [item(1, '가'), item(2, '나'), item(3, '다'), item(4, '라'), item(5, '마')]

  it('정답을 포함해 보기 개수만큼 돌려준다', () => {
    const choices = buildChoices(pool[0], pool, same)
    expect(choices).toHaveLength(CHOICE_COUNT)
    expect(choices).toContain('가')
  })

  it('보기가 서로 겹치지 않는다', () => {
    const dupes = [item(1, '가'), item(2, '가'), item(3, '나'), item(4, '다'), item(5, '라')]
    const choices = buildChoices(dupes[0], dupes, same)
    expect(new Set(choices).size).toBe(CHOICE_COUNT)
  })

  it('다른 뜻이 모자라면 null', () => {
    expect(buildChoices(pool[0], pool.slice(0, 3), same)).toBeNull()
  })
})
