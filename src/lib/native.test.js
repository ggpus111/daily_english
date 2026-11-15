import { describe, expect, it } from 'vitest'
import { parseAuthCallback } from './native'

const BASE = 'com.dailyenglish.app://auth-callback'

describe('parseAuthCallback', () => {
  it('PKCE 코드를 읽는다', () => {
    expect(parseAuthCallback(`${BASE}?code=abc`)).toEqual({ code: 'abc' })
  })

  it('implicit 토큰을 읽는다', () => {
    expect(parseAuthCallback(`${BASE}#access_token=a&refresh_token=r&type=signup`)).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
    })
  })

  it('취소나 오류는 이유를 돌려준다', () => {
    expect(parseAuthCallback(`${BASE}?error=access_denied&error_description=User+cancelled`)).toEqual({
      error: 'User cancelled',
    })
    expect(parseAuthCallback(`${BASE}#error_description=Link+expired`)).toEqual({ error: 'Link expired' })
  })

  it('필요한 값이 없으면 오류로 본다', () => {
    expect(parseAuthCallback(BASE)).toEqual({ error: 'missing session' })
  })
})
