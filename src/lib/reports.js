// 문제 신고와 관리자 기능(supabase/schema.sql의 reports, admins, client_errors).
// 로그인한 사용자만 서버로 보낼 수 있고, 관리자는 모든 신고를 보고 상태와 답변을 고친다.
import { formatErrorLog, readErrorLog } from './errorLog'
import { isNative } from './platform'
import { supabase } from './supabase'
import { failure } from './errors'

export const REPORT_KINDS = ['bug', 'content', 'idea']
export const REPORT_STATUSES = ['new', 'checking', 'fixed', 'wontfix']
export const MAX_MESSAGE = 2000
const MAX_ERROR_LOG = 6000
const LIST_LIMIT = 100

/** 신고 보내기. includeErrors면 이 기기의 오류 기록(사용자 내용 없음)을 붙인다. */
export async function submitReport({ kind, message, includeErrors }) {
  const row = {
    kind,
    message: message.trim().slice(0, MAX_MESSAGE),
    page: (typeof location === 'undefined' ? '' : location.hash.slice(1)) || 'profile',
    version: typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__,
    platform: isNative ? 'android' : 'web',
    error_log: includeErrors ? formatErrorLog(readErrorLog().slice(0, 10)).slice(0, MAX_ERROR_LOG) : '',
  }
  const { error } = await supabase.from('reports').insert(row)
  return error ? failure(error) : {}
}

/** 내가 보낸 신고(최근 것부터). 관리자 답변과 상태를 함께 본다. */
export async function listMyReports(userId) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, created_at, kind, message, status, admin_reply, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return error ? failure(error) : { reports: data ?? [] }
}

export async function checkAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  return error ? false : data === true
}

/** 관리자: 모든 신고. status를 주면 그 상태만 */
export async function listReports(status) {
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(LIST_LIMIT)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  return error ? failure(error) : { reports: data ?? [] }
}

/** 관리자: 상태와 답변 고치기 */
export async function updateReport(id, { status, admin_reply }) {
  const { error } = await supabase
    .from('reports')
    .update({ status, admin_reply: admin_reply.slice(0, MAX_MESSAGE) })
    .eq('id', id)
  return error ? failure(error) : {}
}

/** 관리자: 최근 앱 오류. 같은 메시지끼리 묶어 많이 난 것부터 */
export async function listClientErrors() {
  const { data, error } = await supabase
    .from('client_errors')
    .select('created_at, source, message, page, version, platform, count')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return failure(error)
  return { groups: groupErrors(data ?? []) }
}

export function groupErrors(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.message}|${row.page}`
    const group = groups.get(key) ?? {
      message: row.message,
      page: row.page,
      total: 0,
      last: row.created_at,
      platforms: new Set(),
      versions: new Set(),
    }
    group.total += row.count ?? 1
    if (row.created_at > group.last) group.last = row.created_at
    group.platforms.add(row.platform)
    group.versions.add(row.version)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => ({ ...group, platforms: [...group.platforms], versions: [...group.versions] }))
    .sort((a, b) => b.total - a.total)
}
