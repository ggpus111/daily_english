// 내려받은 백업 파일(JSON)을 읽어 지금 기록에 더할 항목을 고른다.
//
// 파일은 사용자가 고르지만 내용은 믿지 않는다. 아는 항목만, 정해진 형식과 길이로만 받는다.
// - 이 앱이 내려받은 파일: { word: [...], expression: [...], chat: [...], journal: [...] }
// - 원본 앱 브라우저 저장 형식: { savedWords: [...], ... } (src/lib/legacy.js로 바꿔 읽음)

import { CATEGORIES } from './i18n'
import { fromLegacy } from './legacy'
import { MOOD_IDS } from './moods'

export const TYPES = ['word', 'expression', 'chat', 'journal', 'grammar']
/** 마지막으로 백업 파일을 받은 때(프로필, 홈의 백업 안내) */
export const LAST_EXPORT_KEY = 'lastExportAt'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ITEMS = 20000

const TYPE_KEYS = {
  word: ['word', 'words', 'savedWords'],
  expression: ['expression', 'expressions', 'savedExpressions'],
  chat: ['chat', 'chats', 'savedChats'],
  journal: ['journal', 'journals', 'savedJournals'],
  grammar: ['grammar', 'savedGrammar'],
}

// 칸마다 최대 길이. 입력 화면의 maxLength와 맞춘다.
const FIELDS = {
  word: { text: 500, meaning: 1000, example: 2000, category: 30 },
  expression: { text: 500, meaning: 1000, example: 2000, category: 30 },
  chat: { situation: 1000, message: 2000, meaning: 2000, category: 20, note: 2000 },
  journal: { mood: 20, native: 4000, translation: 4000, aiFeedback: 8000, memo: 2000 },
  grammar: { text: 300, meaning: 1000, example: 1000, exampleNative: 1000, source: 20 },
}
const REQUIRED = {
  word: ['text', 'meaning'],
  expression: ['text', 'meaning'],
  chat: ['situation', 'message', 'meaning'],
  journal: ['native'],
  grammar: ['text', 'meaning'],
}
const REVIEW_BOX_MAX = 6

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class BackupError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

const isoOrNull = (value) => {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

// 한 항목을 아는 칸만 남겨 지금 형식으로 만든다. 쓸 수 없으면 null.
function sanitize(type, raw) {
  const item = fromLegacy(type, raw)
  if (!item) return null
  const clean = {}
  for (const [field, max] of Object.entries(FIELDS[type])) {
    const value = item[field]
    if (value != null && typeof value !== 'string') return null
    if ((value ?? '').length > max) return null
    clean[field] = (value ?? '').trim()
  }
  if (REQUIRED[type].some((field) => !clean[field])) return null
  if (type === 'chat' && !CATEGORIES.includes(clean.category)) clean.category = 'other'
  if (type === 'journal' && !MOOD_IDS.includes(clean.mood)) clean.mood = ''

  // 복습 일정은 단어와 표현에만 있고, 형식이 맞을 때만 이어 간다.
  if (type === 'word' || type === 'expression' || type === 'grammar') {
    const box = item.box
    const dueAt = isoOrNull(item.dueAt)
    if (Number.isInteger(box) && box >= 0 && box <= REVIEW_BOX_MAX && dueAt) {
      clean.box = box
      clean.dueAt = dueAt
      const last = isoOrNull(item.lastReviewedAt)
      if (last) clean.lastReviewedAt = last
      // 복습·틀린 횟수는 자연수일 때만 이어 간다(틀린 횟수가 복습 횟수보다 클 수는 없다).
      const reviews = Number.isInteger(item.reviews) && item.reviews >= 0 ? item.reviews : null
      const misses = Number.isInteger(item.misses) && item.misses >= 0 ? item.misses : null
      if (reviews !== null && misses !== null && misses <= reviews) {
        clean.reviews = reviews
        clean.misses = misses
      }
    }
    // 일기 교정에서 담은 표현 표시(복습 방향이 다름)
    if (item.source === 'journal') clean.source = 'journal'
  }

  // 서버 표의 id는 uuid라서, 다른 형식이면 새로 만든다.
  clean.id = typeof item.id === 'string' && UUID.test(item.id) ? item.id.toLowerCase() : crypto.randomUUID()
  clean.createdAt = isoOrNull(item.createdAt) ?? new Date().toISOString()
  return clean
}

/**
 * 파일 내용을 읽어 종류별 항목으로 나눈다.
 * @returns {{ records: Record<string, object[]>, invalid: number }}
 */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('notJson')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BackupError('notBackup')

  const records = { word: [], expression: [], chat: [], journal: [], grammar: [] }
  let invalid = 0
  let total = 0
  let found = false
  for (const type of TYPES) {
    const key = TYPE_KEYS[type].find((name) => Array.isArray(data[name]))
    if (!key) continue
    found = true
    for (const raw of data[key]) {
      total += 1
      if (total > MAX_ITEMS) throw new BackupError('tooMany')
      const item = sanitize(type, raw)
      if (item) records[type].push(item)
      else invalid += 1
    }
  }
  if (!found) throw new BackupError('notBackup')
  return { records, invalid }
}

// 같은 기록인지 내용으로도 본다. 원본 앱 형식은 읽을 때마다 새 id가 붙기 때문이다.
const contentKey = {
  word: (item) => `${item.text.toLowerCase()}\u0000${item.meaning}`,
  expression: (item) => `${item.text.toLowerCase()}\u0000${item.meaning}`,
  chat: (item) => `${item.situation}\u0000${item.message}`,
  journal: (item) => `${item.native}\u0000${item.createdAt.slice(0, 10)}`,
  grammar: (item) => `${item.text.toLowerCase()}\u0000${item.meaning}`,
}

/**
 * 지금 기록에 없는 항목만 고른다.
 * @returns {{ toAdd: Record<string, object[]>, added: number, duplicates: number }}
 */
export function planImport(existing, incoming) {
  const toAdd = {}
  let added = 0
  let duplicates = 0
  for (const type of TYPES) {
    const ids = new Set((existing[type] ?? []).map((item) => String(item.id).toLowerCase()))
    const keys = new Set((existing[type] ?? []).map(contentKey[type]))
    toAdd[type] = []
    for (const item of incoming[type] ?? []) {
      const key = contentKey[type](item)
      if (ids.has(item.id) || keys.has(key)) {
        duplicates += 1
        continue
      }
      ids.add(item.id)
      keys.add(key)
      toAdd[type].push(item)
      added += 1
    }
  }
  return { toAdd, added, duplicates }
}
