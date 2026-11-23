import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  addCustomCategory,
  categoryLabel,
  categoryOptions,
  normalizeCategory,
  readCustomCategories,
  usedCategories,
} from './categories'

const t = (key) => ({ 'wordCategory.love': '연애', 'wordCategory.daily': '일상' })[key] ?? key

beforeEach(() => localStorage.clear())

describe('카테고리', () => {
  it('이름의 앞뒤 공백과 겹친 공백을 정리하고 길이를 자른다', () => {
    expect(normalizeCategory('  K-드라마   대사 ')).toBe('K-드라마 대사')
    expect(normalizeCategory('a'.repeat(40))).toHaveLength(20)
    expect(normalizeCategory(undefined)).toBe('')
  })

  it('기본 카테고리는 번역하고, 직접 만든 건 그대로 보여 준다', () => {
    expect(categoryLabel('love', t)).toBe('연애')
    expect(categoryLabel('K-드라마', t)).toBe('K-드라마')
  })

  it('직접 만든 카테고리를 이 기기에 남기고, 기본 카테고리 이름이면 그 id를 돌려준다', () => {
    expect(addCustomCategory('word', ' 게임 ', t)).toBe('게임')
    expect(addCustomCategory('word', '게임', t)).toBe('게임')
    expect(addCustomCategory('word', '연애', t)).toBe('love')
    expect(addCustomCategory('word', '   ', t)).toBe('')
    expect(readCustomCategories('word')).toEqual(['게임'])
    expect(readCustomCategories('expression')).toEqual([])
  })

  it('고를 수 있는 목록은 기본, 직접 만든 것, 기록에만 있는 것 순서로 겹치지 않게', () => {
    const items = [{ category: '여행 회화' }, { category: 'love' }, {}]
    const options = categoryOptions('word', items, ['게임'])
    expect(options.slice(0, DEFAULT_CATEGORIES.length)).toEqual(DEFAULT_CATEGORIES)
    expect(options.slice(DEFAULT_CATEGORIES.length)).toEqual(['게임', '여행 회화'])
  })

  it('거르기 칩은 실제로 기록이 있는 카테고리만 보여 준다', () => {
    const items = [{ category: '여행 회화' }, { category: 'love' }, { category: 'love' }]
    expect(usedCategories('word', items, ['게임'])).toEqual(['love', '여행 회화'])
  })
})
