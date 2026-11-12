import { CATEGORIES } from './i18n'

// 원본 앱은 대화 카테고리를 한국어 이름 그대로 저장했다.
const CATEGORY_BY_LABEL = {
  일상: 'daily',
  '애정 표현': 'affection',
  장난: 'joke',
  '감정과 관계': 'emotion',
  '약속과 계획': 'plans',
  '군대 / 업무': 'work',
  기타: 'other',
}

const text = (value) => (typeof value === 'string' ? value : '')

export const isCurrentRecord = (item) =>
  Boolean(item) && typeof item.id === 'string' && typeof item.createdAt === 'string'

function createdAtFrom(id) {
  const time = Number(id)
  const date = Number.isFinite(time) && time > 0 ? new Date(time) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function category(value) {
  if (CATEGORIES.includes(value)) return value
  return CATEGORY_BY_LABEL[value] ?? 'other'
}

const FIELDS = {
  word: (item) => ({
    text: text(item.word ?? item.text),
    meaning: text(item.meaning),
    example: text(item.example),
  }),
  expression: (item) => ({
    text: text(item.expression ?? item.text),
    meaning: text(item.meaning),
    example: text(item.example),
  }),
  chat: (item) => ({
    situation: text(item.situation),
    message: text(item.message),
    meaning: text(item.meaning),
    category: category(item.category),
    note: text(item.note ?? item.explanation),
  }),
  journal: (item) => ({
    native: text(item.nativeText ?? item.native),
    translation: text(item.translation),
    aiFeedback: text(item.aiFeedback),
    memo: text(item.note ?? item.memo),
  }),
}

// 원본 앱 형식의 기록을 지금 형식으로 바꾼다. 읽을 수 없는 값은 null이다.
export function fromLegacy(type, item) {
  if (isCurrentRecord(item)) return item
  if (!item || typeof item !== 'object' || !FIELDS[type]) return null
  return { id: crypto.randomUUID(), createdAt: createdAtFrom(item.id), ...FIELDS[type](item) }
}
