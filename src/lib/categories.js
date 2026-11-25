// 단어·표현·대화 기록 카테고리. 기본 카테고리는 id로 저장하고 화면에서 번역하며, 직접 만든 카테고리는 적은 이름 그대로 저장한다.
// 직접 만든 이름은 이 기기에 목록으로 남기고(아직 기록이 없어도 고를 수 있게), 기록에 쓰인 이름도 합쳐 보여 준다
// (다른 기기에서 만든 카테고리도 기록을 따라 보이게).
import { CATEGORIES as CHAT_CATEGORIES } from './i18n'
import { local } from './storage'

export const DEFAULT_CATEGORIES = ['daily', 'love', 'friends', 'feelings', 'travel', 'food', 'work']
export const CATEGORY_MAX = 20
const customKey = (type) => `customCategories:${type}`

export const normalizeCategory = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, CATEGORY_MAX)

// 기록 종류마다 기본 카테고리와 번역 키 앞부분이 다르다(대화 기록은 원래 있던 category.* 를 그대로 쓴다).
const SETS = { chat: { defaults: CHAT_CATEGORIES, prefix: 'category' } }
const setFor = (type) => SETS[type] ?? { defaults: DEFAULT_CATEGORIES, prefix: 'wordCategory' }
export const defaultCategories = (type) => setFor(type).defaults

export const isDefaultCategory = (value, type = 'word') => setFor(type).defaults.includes(value)

/** 화면에 보일 이름: 기본은 번역, 직접 만든 건 그대로. */
export const categoryLabel = (value, t, type = 'word') =>
  isDefaultCategory(value, type) ? t(`${setFor(type).prefix}.${value}`) : value

export function readCustomCategories(type) {
  const list = local.getJson(customKey(type))
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item.trim()) : []
}

/** 직접 만든 카테고리를 더한다. 기본 카테고리 이름이나 이미 있는 이름이면 그대로 둔다. 정리된 이름을 돌려준다. */
export function addCustomCategory(type, value, t) {
  const name = normalizeCategory(value)
  if (!name) return ''
  const { defaults, prefix } = setFor(type)
  const fromDefault = defaults.find((id) => t(`${prefix}.${id}`) === name)
  if (fromDefault) return fromDefault
  const list = readCustomCategories(type)
  if (!list.includes(name)) local.set(customKey(type), JSON.stringify([...list, name]))
  return name
}

/** 고를 수 있는 카테고리: 기본 → 직접 만든 것 → 기록에만 있는 것 순서, 겹치지 않게. */
export function categoryOptions(type, items, custom = readCustomCategories(type)) {
  const used = items.map((item) => normalizeCategory(item.category)).filter(Boolean)
  return [...new Set([...setFor(type).defaults, ...custom, ...used])]
}

/** 목록 거르기용: 실제로 기록이 있는 카테고리만, 고를 수 있는 순서대로. */
export function usedCategories(type, items, custom) {
  const used = new Set(items.map((item) => normalizeCategory(item.category)).filter(Boolean))
  return categoryOptions(type, items, custom).filter((value) => used.has(value))
}
