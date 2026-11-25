import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureInviteFromUrl, clearPendingInvite, inviteLink, readPendingInvite } from './invite'

const fakeLocation = (search, hash = '#couple') => ({ search, hash, pathname: '/' })

describe('친구 초대 링크', () => {
  beforeEach(() => localStorage.clear())

  it('초대 번호를 넣은 링크를 만들고, 열면 친구 화면으로 간다', () => {
    const link = inviteLink('ABC234')
    expect(link).toMatch(/\/\?invite=ABC234#couple$/)
  })

  it('링크로 들어오면 번호를 이 기기에 남기고 주소에서 지운다', () => {
    const history = { replaceState: vi.fn() }
    expect(captureInviteFromUrl(fakeLocation('?invite=abc234'), history)).toBe('ABC234')
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/#couple')
    expect(readPendingInvite()).toBe('ABC234')
    clearPendingInvite()
    expect(readPendingInvite()).toBe('')
  })

  it('번호 모양이 틀리면 남기지 않고, 초대가 없는 주소는 건드리지 않는다', () => {
    const history = { replaceState: vi.fn() }
    expect(captureInviteFromUrl(fakeLocation('?invite=hello!'), history)).toBeNull()
    expect(readPendingInvite()).toBe('')
    const untouched = { replaceState: vi.fn() }
    expect(captureInviteFromUrl(fakeLocation('?ref=x'), untouched)).toBeNull()
    expect(untouched.replaceState).not.toHaveBeenCalled()
  })
})
