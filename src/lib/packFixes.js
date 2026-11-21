// 꾸러미 내용 고치기(supabase/schema.sql의 pack_fixes).
// 앱에 든 꾸러미(src/data/*.json) 위에 관리자가 고친 뜻·예문을 덮어쓰고, 숨긴 항목은 뺀다.
// 서버가 느리거나 연결이 없으면 꾸러미를 기다리게 하지 않는다: 마지막으로 받은 고침(이 기기에 보관)을 쓴다.
import { local } from './storage'
import { supabase } from './supabase'

const CACHE_KEY = 'packFixes'
const FETCH_TIMEOUT_MS = 3000

/** 앱 항목의 이름 → 서버 칸 이름 */
export const FIX_FIELDS = { meaning: 'meaning', example: 'example', exampleKo: 'example_ko', tip: 'tip' }
export const FIX_LIMITS = { meaning: 200, example: 300, exampleKo: 300, tip: 300, note: 500 }

const fail = (error) => ({ error: { message: error?.message ?? String(error), status: error?.status } })

function readCache(kind) {
  const cache = local.getJson(CACHE_KEY)
  return Array.isArray(cache?.[kind]) ? cache[kind] : []
}

function writeCache(kind, rows) {
  const cache = local.getJson(CACHE_KEY) ?? {}
  local.set(CACHE_KEY, JSON.stringify({ ...cache, [kind]: rows }))
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

/** 꾸러미를 보여 줄 때 쓰는 고침 목록. 실패하면 이 기기에 보관한 마지막 목록. */
export async function fetchPackFixes(kind) {
  if (!supabase) return []
  try {
    const { data, error } = await withTimeout(supabase.from('pack_fixes').select('*').eq('kind', kind), FETCH_TIMEOUT_MS)
    if (error) throw error
    writeCache(kind, data ?? [])
    return data ?? []
  } catch {
    return readCache(kind)
  }
}

/** 항목 목록에 고침을 덮어쓴다. 숨긴 항목은 빼고, 예문을 바꾸면 Tatoeba 출처 번호를 뗀다. */
export function applyFixes(items, rows) {
  if (!rows?.length) return items
  const byId = new Map(rows.map((row) => [row.item_id, row]))
  return items.flatMap((item) => {
    const fix = byId.get(item.id)
    if (!fix) return [item]
    if (fix.hidden) return []
    const next = { ...item, fixed: true }
    for (const [field, column] of Object.entries(FIX_FIELDS)) {
      if (fix[column] != null && fix[column] !== '') next[field] = fix[column]
    }
    if (next.example !== item.example) delete next.tatoeba
    return [next]
  })
}

/** 관리자: 고침 목록(최근에 고친 것부터) */
export async function listPackFixes(kind) {
  const { data, error } = await supabase.from('pack_fixes').select('*').eq('kind', kind).order('updated_at', { ascending: false })
  return error ? fail(error) : { fixes: data ?? [] }
}

/** 관리자: 고치기. 원래 값과 같은 칸은 비워서(null) 원래 값을 따라가게 한다. */
export async function savePackFix(kind, item, values) {
  const row = { item_id: item.id, kind, hidden: Boolean(values.hidden), note: (values.note ?? '').trim().slice(0, FIX_LIMITS.note) }
  for (const [field, column] of Object.entries(FIX_FIELDS)) {
    const value = (values[field] ?? '').trim().slice(0, FIX_LIMITS[field])
    row[column] = value && value !== (item[field] ?? '') ? value : null
  }
  const { error } = await supabase.from('pack_fixes').upsert(row, { onConflict: 'item_id' })
  return error ? fail(error) : {}
}

/** 관리자: 원래대로 되돌리기 */
export async function removePackFix(itemId) {
  const { error } = await supabase.from('pack_fixes').delete().eq('item_id', itemId)
  return error ? fail(error) : {}
}
