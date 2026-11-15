import { useCallback, useEffect, useRef, useState } from 'react'
import { errorKind } from './errors'
import { fromLegacy, isCurrentRecord } from './legacy'
import { local } from './storage'
import { supabase } from './supabase'

const TABLE = 'study_records'
const PAGE_SIZE = 1000
const UPLOAD_CHUNK = 500
const STORAGE_KEYS = {
  word: 'savedWords',
  expression: 'savedExpressions',
  chat: 'savedChats',
  journal: 'savedJournals',
}

export const STORAGE_ERROR = 'storage'
export const JOURNAL_DRAFT_KEY = 'journalDraft'

const emptyRecords = () => ({ word: [], expression: [], chat: [], journal: [] })
const byNewest = (a, b) => b.createdAt.localeCompare(a.createdAt)

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

// 화면에서 오류 종류를 가릴 수 있게 문구와 HTTP 상태만 남긴다(src/lib/errors.js).
const failure = (error, status) => ({ message: error?.message ?? String(error), status })

function fromRow(row) {
  return { ...row.data, id: row.id, createdAt: row.created_at }
}

// PostgREST는 한 번에 최대 1000행만 돌려주므로 끝까지 나눠 읽는다.
async function fetchAllRows() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error, status } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { error: failure(error, status) }
    rows.push(...data)
    if (data.length < PAGE_SIZE) return { rows }
  }
}

async function migrateLocal(userId) {
  const rows = Object.entries(readLocal({ includeLegacy: false })).flatMap(([type, items]) =>
    items.map((item) => toRow(type, item, userId)),
  )
  if (rows.length === 0) return null
  const { error, status } = await supabase.from(TABLE).upsert(rows)
  if (!error) clearLocal()
  return error ? failure(error, status) : null
}

// ---------- 오프라인 저장 ----------
// 로그인 모드에서 연결이 끊기면 바꾼 내용을 이 기기에 줄 세워 두었다가, 연결되면 차례로 올린다.
// 마지막으로 불러온 기록도 이 기기에 남겨 두어, 연결 없이 앱을 열어도 기록을 볼 수 있게 한다.
// 작업: { kind: 'upsert', type, item } 또는 { kind: 'delete', type, id }
const pendingKey = (userId) => `pendingOps:${userId}`
const cacheKey = (userId) => `recordsCache:${userId}`

export const readPending = (userId) => {
  const ops = local.getJson(pendingKey(userId))
  return Array.isArray(ops) ? ops : []
}
const writePending = (userId, ops) =>
  ops.length ? local.set(pendingKey(userId), JSON.stringify(ops)) : local.remove(pendingKey(userId))

function readCache(userId) {
  const cached = local.getJson(cacheKey(userId))
  if (!cached || typeof cached !== 'object') return null
  const records = emptyRecords()
  for (const type of Object.keys(records)) {
    if (Array.isArray(cached[type])) records[type] = cached[type].filter(isCurrentRecord)
  }
  return records
}

/** 로그아웃·계정 삭제 때 이 기기에 남긴 사본을 지운다. 올리지 못한 작업은 같은 계정으로 다시 로그인하면 올라간다. */
export function clearUserCache(userId, { includePending = false } = {}) {
  if (!userId) return
  local.remove(cacheKey(userId))
  if (includePending) local.remove(pendingKey(userId))
}

// 연결이 끊긴 탓에 실패한 것만 나중에 다시 보낸다. 권한·형식 오류는 다시 보내도 같다.
const isConnectionProblem = (error) => ['offline', 'connection', 'timeout'].includes(errorKind(error))
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

async function sendOps(ops, userId) {
  if (ops[0].kind === 'delete') {
    const { error, status } = await supabase.from(TABLE).delete().eq('id', ops[0].id)
    return error ? failure(error, status) : null
  }
  const { error, status } = await supabase.from(TABLE).upsert(ops.map((op) => toRow(op.type, op.item, userId)))
  return error ? failure(error, status) : null
}

// 줄 서 있는 작업을 지금 기록에 덧입힌다(서버에서 막 읽어 온 기록 위에 아직 못 올린 변경을 반영).
function applyOps(records, ops) {
  const next = { ...records }
  for (const op of ops) {
    const list = next[op.type]
    if (!list) continue
    if (op.kind === 'delete') {
      next[op.type] = list.filter((item) => item.id !== op.id)
    } else {
      const exists = list.some((item) => item.id === op.item.id)
      next[op.type] = exists
        ? list.map((item) => (item.id === op.item.id ? op.item : item))
        : [...list, op.item].sort(byNewest)
    }
  }
  return next
}

export function useRecords(user) {
  const userId = user?.id ?? null
  const [records, setRecords] = useState(() => (supabase ? emptyRecords() : readLocal()))
  const [loading, setLoading] = useState(Boolean(supabase))
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [storageFailed, setStorageFailed] = useState(() => !supabase && !canWriteLocal())
  const [pendingCount, setPendingCount] = useState(() => (userId ? readPending(userId).length : 0))
  const recordsRef = useRef(records)
  const userIdRef = useRef(userId)
  const flushing = useRef(false)

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const commit = useCallback((change) => {
    const next = change(recordsRef.current)
    recordsRef.current = next
    setRecords(next)
    if (!supabase) setStorageFailed(!writeLocal(next))
    else if (userIdRef.current) local.set(cacheKey(userIdRef.current), JSON.stringify(next))
  }, [])

  const enqueue = useCallback((ops) => {
    const id = userIdRef.current
    const queue = [...readPending(id), ...ops]
    writePending(id, queue)
    setPendingCount(queue.length)
  }, [])

  // 서버에 보내고, 연결 문제로 못 보내면 줄 세운다. { error } 또는 { queued } 를 돌려준다.
  const send = useCallback(
    async (ops) => {
      if (!supabase) return {}
      const id = userIdRef.current
      if (isOffline() || readPending(id).length > 0) {
        // 앞선 작업이 남아 있으면 순서를 지키려고 뒤에 붙인다.
        enqueue(ops)
        return { queued: true }
      }
      for (let start = 0; start < ops.length; start += UPLOAD_CHUNK) {
        const chunk = ops.slice(start, start + UPLOAD_CHUNK)
        const error = await sendOps(chunk, id)
        if (!error) continue
        if (!isConnectionProblem(error)) return { error }
        enqueue(ops.slice(start))
        return { queued: true }
      }
      return {}
    },
    [enqueue],
  )

  // 줄 서 있는 작업을 차례로 올린다. 연결 문제면 멈추고, 그 밖의 오류면 그 작업을 버리고 알린다.
  const flush = useCallback(async () => {
    const id = userIdRef.current
    if (!supabase || !id || flushing.current || isOffline()) return
    flushing.current = true
    try {
      let queue = readPending(id)
      while (queue.length > 0) {
        const error = await sendOps([queue[0]], id)
        if (error && isConnectionProblem(error)) break
        if (error) setLoadError(error)
        queue = queue.slice(1)
        writePending(id, queue)
        setPendingCount(queue.length)
      }
    } finally {
      flushing.current = false
    }
  }, [])

  useEffect(() => {
    if (!supabase || !userId) return undefined
    let active = true

    async function load() {
      setLoadError(null)
      setPendingCount(readPending(userId).length)
      // 이 기기에 남긴 기록이 있으면 먼저 보여 주고, 서버에서 받아 오면 바꾼다.
      // 연결이 느리거나 끊겨도 빈 화면이나 "불러오는 중"에 오래 머물지 않는다.
      const cached = readCache(userId)
      if (cached) {
        commit(() => applyOps(cached, readPending(userId)))
        setLoading(false)
      } else {
        setLoading(true)
      }
      if (isOffline()) {
        if (!cached) setLoadError(failure({ message: 'Failed to fetch' }))
        setLoading(false)
        return
      }
      try {
        await flush()
        const migrateError = await migrateLocal(userId)
        const { rows, error } = await fetchAllRows()
        if (!active) return
        if (rows) {
          const next = emptyRecords()
          rows.forEach((row) => next[row.type]?.push(fromRow(row)))
          commit(() => applyOps(next, readPending(userId)))
        } else if (!cached || !isConnectionProblem(error)) {
          // 연결 문제인데 남긴 기록이 있으면 그대로 보여 준다. 오프라인 안내는 화면 위쪽에 따로 나온다.
          setLoadError(error)
        }
        if (migrateError) setLoadError(migrateError)
      } catch (error) {
        if (active) setLoadError(failure(error))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [userId, commit, flush, attempt])

  // 연결이 돌아오면 줄 서 있던 작업을 올린다.
  useEffect(() => {
    if (!supabase) return undefined
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [flush])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])

  const add = useCallback(
    async (type, fields) => {
      const item = { ...fields, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      const result = await send([{ kind: 'upsert', type, item }])
      if (result.error) return result
      commit((prev) => ({ ...prev, [type]: [item, ...prev[type]] }))
      return result
    },
    [send, commit],
  )

  // 넘겨준 항목만 바꾸고 나머지(복습 일정 등)는 그대로 둔다.
  const update = useCallback(
    async (type, id, fields) => {
      const current = recordsRef.current[type].find((item) => item.id === id)
      if (!current) return { error: { message: 'not found' } }
      const item = { ...current, ...fields, id, createdAt: current.createdAt }
      const result = await send([{ kind: 'upsert', type, item }])
      if (result.error) return result
      commit((prev) => ({
        ...prev,
        [type]: prev[type].map((entry) => (entry.id === id ? item : entry)),
      }))
      return result
    },
    [send, commit],
  )

  // 삭제 되돌리기. 같은 id와 작성 시각으로 다시 넣는다.
  const restore = useCallback(
    async (type, item) => {
      const result = await send([{ kind: 'upsert', type, item }])
      if (result.error) return result
      commit((prev) => ({ ...prev, [type]: [...prev[type], item].sort(byNewest) }))
      return result
    },
    [send, commit],
  )

  const remove = useCallback(
    async (type, id) => {
      const result = await send([{ kind: 'delete', type, id }])
      if (result.error) return result
      commit((prev) => ({ ...prev, [type]: prev[type].filter((item) => item.id !== id) }))
      return result
    },
    [send, commit],
  )

  // 백업 파일에서 고른 기록을 더한다(src/lib/backup.js의 planImport 결과).
  const importRecords = useCallback(
    async (toAdd) => {
      const ops = Object.entries(toAdd).flatMap(([type, items]) =>
        items.map((item) => ({ kind: 'upsert', type, item })),
      )
      if (ops.length === 0) return {}
      const result = await send(ops)
      if (result.error) return result
      commit((prev) => applyOps(prev, ops))
      return result
    },
    [send, commit],
  )

  const removeAll = useCallback(() => commit(emptyRecords), [commit])

  return {
    records,
    loading,
    loadError: storageFailed ? STORAGE_ERROR : loadError,
    pendingCount,
    reload,
    add,
    update,
    remove,
    restore,
    importRecords,
    removeAll,
  }
}
