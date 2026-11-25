// 꾸러미 신고(supabase/pack-reports.sql). 신고하면 그 항목은 바로 모두에게서 숨겨지고, 관리자가 확인한다.
import { failure } from './errors'
import { forgetPackData } from './packs'
import { hideInCache } from './packFixes'
import { supabase } from './supabase'

export const REPORT_REASONS = ['wrong', 'offensive', 'unnatural', 'other']
export const REPORT_NOTE_MAX = 300
// 꾸러미를 다시 불러오라는 신호(usePackData가 듣는다)
export const PACK_FIXES_EVENT = 'pack-fixes-changed'
// 카드 종류(expression·word·grammar) → 꾸러미 종류
export const PACK_KIND = { expression: 'expressions', word: 'words', grammar: 'grammar' }

/** 신고하기. 성공하면 이 기기에서도 바로 숨기고 꾸러미 화면을 다시 그리게 한다. */
export async function reportPackItem({ item, kind, reason, note = '', lang = 'en' }) {
  if (!supabase) return { error: { kind: 'login' } }
  const packKind = PACK_KIND[kind] ?? kind
  const { error } = await supabase.rpc('report_pack_item', {
    target_item: item.id,
    target_kind: packKind,
    why: reason,
    memo: note.trim().slice(0, REPORT_NOTE_MAX),
    label: String(item.text ?? '').slice(0, 200),
  })
  if (error) {
    if (/not signed in/.test(error.message)) return { error: { kind: 'login' } }
    if (/report limit/.test(error.message)) return { error: { kind: 'limit' } }
    return failure(error)
  }
  hideInCache(packKind, item.id)
  forgetPackData(packKind, lang)
  window.dispatchEvent(new Event(PACK_FIXES_EVENT))
  return {}
}

/** 관리자: 신고 목록(최근 것부터). 같은 항목 신고는 한 줄로 묶는다. */
export async function listPackReports() {
  const { data, error } = await supabase
    .from('pack_reports')
    .select('item_id, kind, item_text, reason, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return failure(error)
  const grouped = new Map()
  for (const row of data ?? []) {
    const entry = grouped.get(row.item_id) ?? { ...row, count: 0, reasons: [], notes: [] }
    entry.count += 1
    if (!entry.reasons.includes(row.reason)) entry.reasons.push(row.reason)
    if (row.note) entry.notes.push(row.note)
    grouped.set(row.item_id, entry)
  }
  return { reports: [...grouped.values()] }
}

/** 관리자: 신고가 잘못됐으면 다시 보이게 하고 신고를 지운다. */
export async function restorePackItem(itemId) {
  const { error } = await supabase.from('pack_fixes').update({ hidden: false }).eq('item_id', itemId)
  if (error) return failure(error)
  return dismissPackReports(itemId)
}

/** 관리자: 숨긴 채로 두고 신고만 정리한다. */
export async function dismissPackReports(itemId) {
  const { error } = await supabase.from('pack_reports').delete().eq('item_id', itemId)
  return error ? failure(error) : {}
}
