import { Share } from '@capacitor/share'
import { isNative } from './platform'
import { local } from './storage'

/**
 * 친구·연인 초대 링크. 링크를 연 사람은 친구 화면에서 초대 번호가 미리 채워진 채로 시작한다.
 * 링크 모양: https://사이트/?invite=ABC234#couple (번호는 6자리, 헷갈리는 0·O·1·I 없음)
 * 로그인 전에 열어도 이 기기에 번호를 남겨 두었다가, 로그인한 뒤 친구 화면에서 채운다.
 */
const PENDING_KEY = 'pendingInvite'
const CODE = /^[A-HJ-NP-Z2-9]{6}$/
// 앱 안에서는 웹사이트 주소로 링크를 만든다(받는 사람이 앱이 없어도 웹에서 열 수 있게).
const DEFAULT_SITE = 'https://daily-english-eight-mocha.vercel.app'

export function siteUrl() {
  const configured = import.meta.env.VITE_SITE_URL
  if (configured) return configured.replace(/\/$/, '')
  return isNative ? DEFAULT_SITE : window.location.origin
}

export const inviteLink = (code) => `${siteUrl()}/?invite=${encodeURIComponent(code)}#couple`

/** 주소에 초대 번호가 있으면 이 기기에 남기고 주소에서 지운다(다시 열어도 또 채우지 않게). */
export function captureInviteFromUrl(location = window.location, history = window.history) {
  const params = new URLSearchParams(location.search)
  const code = params.get('invite')?.trim().toUpperCase()
  if (!params.has('invite')) return null
  params.delete('invite')
  const query = params.toString()
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash || '#couple'}`)
  if (!code || !CODE.test(code)) return null
  local.set(PENDING_KEY, code)
  return code
}

export const readPendingInvite = () => {
  const code = local.get(PENDING_KEY)
  return code && CODE.test(code) ? code : ''
}

export const clearPendingInvite = () => local.remove(PENDING_KEY)

/**
 * 초대 링크 보내기: 앱은 안드로이드 공유 창, 웹은 휴대폰 공유 창(되는 브라우저만), 안 되면 링크를 복사한다.
 * 돌려주는 값: 'shared' | 'copied' | 'cancelled' | 'failed'
 */
export async function shareInvite(code, { title, text }) {
  const url = inviteLink(code)
  try {
    if (isNative) {
      await Share.share({ title, text, url })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
  } catch (error) {
    if (error?.name === 'AbortError' || /cancel/i.test(error?.message ?? '')) return 'cancelled'
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
