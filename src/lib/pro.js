// Pro 회원. 결제는 아직 없고, 관리자가 관리자 페이지에서 이메일로 지정한 계정만 Pro다(supabase/schema.sql의 pro_members).
// 화면은 여기서 Pro인지 알아 기능을 열고 닫지만, 실제로 Claude를 쓰게 할지는 서버 함수가 다시 확인한다.
import { failure } from './errors'
import { supabase } from './supabase'

/** 이 사용자가 Pro 회원인지. 서버에 연결이 안 되거나 표가 없으면 false. */
export async function fetchIsPro(userId) {
  if (!supabase || !userId) return false
  try {
    const { data, error } = await supabase.from('pro_members').select('user_id').eq('user_id', userId).maybeSingle()
    return !error && Boolean(data)
  } catch {
    return false
  }
}

/** 관리자: 이메일로 Pro를 지정하거나(enabled) 해제한다. 관리자가 아니면 서버가 거절한다. */
export async function adminSetPro({ email, enabled, note = '' }) {
  const { error } = await supabase.rpc('admin_set_pro', {
    target_email: email.trim(),
    enabled,
    memo: note.trim() || null,
  })
  return error ? failure(error) : {}
}

/** 관리자: Pro 회원 목록(이메일, 메모, 지정한 때). */
export async function adminListPro() {
  const { data, error } = await supabase.rpc('admin_list_pro')
  return error ? failure(error) : { members: data ?? [] }
}
