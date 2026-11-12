import { useCallback, useEffect, useRef, useState } from 'react'
import { fromLegacy, isCurrentRecord } from './legacy'
import { local } from './storage'
import { supabase } from './supabase'

const TABLE = 'study_records'
const PAGE_SIZE = 1000
const STORAGE_KEYS = {
  word: 'savedWords',
  expression: 'savedExpressions',
  chat: 'savedChats',
  journal: 'savedJournals',
}

export const STORAGE_ERROR = 'storage'
export const JOURNAL_DRAFT_KEY = 'journalDraft'

const emptyRecords = () => ({ word: [], expression: [], chat: [], journal: [] })

// 원본 앱이 남긴 브라우저 기록은 지금 형식으로 바꿔 읽는다.
// 로그인 모드에서는 원본 기록이 이미 클라우드에 있으므로 legacy를 빼고 읽는다.
export function readLocal({ includeLegacy = true } = {}) {
  const records = emptyRecords()
  for (const [type, key] of Object.entries(STORAGE_KEYS)) {
    const items = local.getJson(key)
    if (!Array.isArray(items)) continue
    records[type] = includeLegacy
      ? items.map((item) => fromLegacy(type, item)).filter(Boolean)
      : items.filter(isCurrentRecord)
  }
  return records
}

function writeLocal(records) {
  return Object.entries(STORAGE_KEYS).every(([type, key]) =>
    local.set(key, JSON.stringify(records[type])),
  )
}

function canWriteLocal() {
  const writable = local.set('storageProbe', '1')
  local.remove('storageProbe')
  return writable
}

function clearLocal() {
  Object.values(STORAGE_KEYS).forEach(local.remove)
}

function toRow(type, item, userId) {
  const { id, createdAt, ...data } = item
  return { id, user_id: userId, type, data, created_at: createdAt }
}

function fromRow(row) {
  return { ...row.data, id: row.id, createdAt: row.created_at }
}

// PostgREST는 한 번에 최대 1000행만 돌려주므로 끝까지 나눠 읽는다.
async function fetchAllRows() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { error }
    rows.push(...data)
    if (data.length < PAGE_SIZE) return { rows }
  }
}

async function migrateLocal(userId) {
  const rows = Object.entries(readLocal({ includeLegacy: false })).flatMap(([type, items]) =>
    items.map((item) => toRow(type, item, userId)),
  )
  if (rows.length === 0) return null
  const { error } = await supabase.from(TABLE).upsert(rows)
  if (!error) clearLocal()
  return error
}

export function useRecords(user) {
  const userId = user?.id ?? null
  const [records, setRecords] = useState(() => (supabase ? emptyRecords() : readLocal()))
  const [loading, setLoading] = useState(Boolean(supabase))
  const [loadError, setLoadError] = useState('')
  const [storageFailed, setStorageFailed] = useState(() => !supabase && !canWriteLocal())
  const recordsRef = useRef(records)

  const commit = useCallback((change) => {
    const next = change(recordsRef.current)
    recordsRef.current = next
    setRecords(next)
    if (!supabase) setStorageFailed(!writeLocal(next))
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return undefined
    let active = true

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const migrateError = await migrateLocal(userId)
        const { rows, error } = await fetchAllRows()
        if (!active) return
        if (migrateError || error) setLoadError((migrateError ?? error).message)
        if (rows) {
          const next = emptyRecords()
          rows.forEach((row) => next[row.type]?.push(fromRow(row)))
          commit(() => next)
        }
      } catch (error) {
        if (active) setLoadError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [userId, commit])

  const add = useCallback(
    async (type, fields) => {
      const item = { ...fields, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      if (supabase) {
        const { error } = await supabase.from(TABLE).insert(toRow(type, item, userId))
        if (error) return { error: error.message }
      }
      commit((prev) => ({ ...prev, [type]: [item, ...prev[type]] }))
      return {}
    },
    [userId, commit],
  )

  // 넘겨준 항목만 바꾸고 나머지(복습 일정 등)는 그대로 둔다.
  const update = useCallback(
    async (type, id, fields) => {
      const current = recordsRef.current[type].find((item) => item.id === id)
      if (!current) return { error: 'not found' }
      const { createdAt, ...rest } = current
      delete rest.id
      const data = { ...rest, ...fields }
      if (supabase) {
        const { error } = await supabase.from(TABLE).update({ data }).eq('id', id)
        if (error) return { error: error.message }
      }
      commit((prev) => ({
        ...prev,
        [type]: prev[type].map((item) => (item.id === id ? { ...data, id, createdAt } : item)),
      }))
      return {}
    },
    [commit],
  )

  // 삭제 되돌리기. 같은 id와 작성 시각으로 다시 넣는다.
  const restore = useCallback(
    async (type, item) => {
      if (supabase) {
        const { error } = await supabase.from(TABLE).insert(toRow(type, item, userId))
        if (error) return { error: error.message }
      }
      commit((prev) => ({
        ...prev,
        [type]: [...prev[type], item].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      return {}
    },
    [userId, commit],
  )

  const remove = useCallback(
    async (type, id) => {
      if (supabase) {
        const { error } = await supabase.from(TABLE).delete().eq('id', id)
        if (error) return { error: error.message }
      }
      commit((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== id) }))
      return {}
    },
    [commit],
  )

  const removeAll = useCallback(() => commit(emptyRecords), [commit])

  return {
    records,
    loading,
    loadError: storageFailed ? STORAGE_ERROR : loadError,
    add,
    update,
    remove,
    restore,
    removeAll,
  }
}
