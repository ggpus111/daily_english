import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readLocal } from './records'
import { local } from './storage'

beforeEach(() => localStorage.clear())

describe('readLocal', () => {
  it('저장된 기록을 종류별로 읽는다', () => {
    const word = { id: 'a', createdAt: '2026-01-01', text: 'hi', meaning: '안녕' }
    localStorage.setItem('savedWords', JSON.stringify([word]))
    expect(readLocal().word).toEqual([word])
  })

  it('손상된 값과 읽을 수 없는 항목을 버린다', () => {
    localStorage.setItem('savedChats', '{not json')
    localStorage.setItem('savedWords', JSON.stringify([null, 3, 'text']))
    localStorage.setItem('savedJournals', JSON.stringify({ not: 'array' }))
    expect(readLocal()).toEqual({ word: [], expression: [], chat: [], journal: [], grammar: [] })
  })

  it('원본 앱 형식은 바꿔 읽고, 로그인 모드에서는 빼고 읽는다', () => {
    const current = { id: 'a', createdAt: '2026-01-01', text: 'new', meaning: '새' }
    const legacy = { id: 1731400000000, word: 'old', meaning: '옛' }
    localStorage.setItem('savedWords', JSON.stringify([current, legacy]))
    expect(readLocal().word.map((item) => item.text)).toEqual(['new', 'old'])
    expect(readLocal({ includeLegacy: false }).word).toEqual([current])
  })
})

describe('storage', () => {
  it('저장이 실패해도 예외를 던지지 않고 false를 돌려준다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(local.set('a', 'b')).toBe(false)
  })

  it('읽기가 실패하면 null을 돌려준다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(local.get('a')).toBeNull()
    expect(local.getJson('a')).toBeNull()
  })
})
