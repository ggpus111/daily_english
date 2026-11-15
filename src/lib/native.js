import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isAuthCallback, isNative } from './platform'
import { supabase } from './supabase'

// 시스템 브라우저에서 로그인하고 딥링크로 돌아오면 세션을 만든다.
// 코드(PKCE) 방식과 토큰(implicit) 방식을 모두 받는다.
export function parseAuthCallback(url) {
  const parsed = new URL(url)
  const query = parsed.searchParams
  const hash = new URLSearchParams(parsed.hash.slice(1))
  const error = query.get('error_description') ?? hash.get('error_description')
  if (error) return { error: error.replace(/\+/g, ' ') }
  const code = query.get('code')
  if (code) return { code }
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken) return { accessToken, refreshToken }
  return { error: 'missing session' }
}

// 등록을 해제하는 함수를 돌려준다. 해제하지 않으면 같은 로그인을 두 번 처리하게 된다.
export function initNativeAuth(onError) {
  if (!isNative || !supabase) return undefined
  const listener = App.addListener('appUrlOpen', async ({ url }) => {
    if (!isAuthCallback(url)) return
    await Browser.close().catch(() => {})
    const result = parseAuthCallback(url)
    let error = result.error
    if (result.code) {
      ;({ error } = await supabase.auth.exchangeCodeForSession(result.code))
    } else if (result.accessToken) {
      ;({ error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      }))
    }
    if (error) onError(error)
  })
  return () => {
    listener.then((handle) => handle.remove())
  }
}

export async function openExternal(url) {
  await Browser.open({ url })
}

// 앱 안 웹뷰는 파일 내려받기를 못 하므로, 임시 파일로 쓰고 공유 창을 띄운다.
export async function shareJsonFile(fileName, content) {
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  await Share.share({ title: fileName, files: [uri] })
}

// 이미지(base64 PNG)를 임시 파일로 쓰고 공유 창을 띄운다(이번 주 돌아보기 저장).
export async function shareImageFile(fileName, base64) {
  const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
  await Share.share({ title: fileName, files: [uri] })
}
