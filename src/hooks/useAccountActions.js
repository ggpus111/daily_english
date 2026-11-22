import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { clearUserCache } from '../lib/records'
import { supabase } from '../lib/supabase'
import { stopWebPush } from '../lib/webPush'

/** 로그아웃과 계정 삭제. 프로필과 설정 화면이 같이 쓴다. */
export function useAccountActions() {
  const { t, notify, user } = useApp()

  // 이 기기에 남긴 기록 사본은 지운다. 올리지 못한 변경은 다시 로그인하면 올라간다.
  async function logOut() {
    clearUserCache(user?.id)
    // 로그아웃한 뒤에는 이 계정의 웹 알림이 오지 않게, 아직 안 보낸 알림과 이 브라우저의 푸시 주소를 지운다.
    await stopWebPush().catch(() => {})
    await supabase.auth.signOut()
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      notify(t('deleteAccountError', { message: errorMessage(error, t) }))
      return
    }
    clearUserCache(user?.id, { includePending: true })
    await supabase.auth.signOut()
  }

  return { logOut, deleteAccount }
}
