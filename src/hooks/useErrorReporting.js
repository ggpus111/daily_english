import { useEffect } from 'react'
import { setErrorSender } from '../lib/errorLog'
import { supabase } from '../lib/supabase'

// 로그인했으면 앱 오류를 서버(client_errors)로도 보낸다. 기록 내용은 보내지 않는다(src/lib/errorLog.js).
export function useErrorReporting(user) {
  useEffect(() => {
    if (!supabase || !user) return undefined
    setErrorSender(async ({ source, message, stack, page, version, platform, online, count }) => {
      const { error } = await supabase
        .from('client_errors')
        .insert({ source, message, stack, page, version, platform, online, count })
      if (error) throw error
    })
    return () => setErrorSender(null)
  }, [user])
}
