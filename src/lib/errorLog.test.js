import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearErrorLog, formatErrorLog, readErrorLog, recordError, setErrorSender } from './errorLog'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#journal'
})
afterEach(() => setErrorSender(null))

describe('오류 기록', () => {
  it('메시지, 화면, 출처, 환경을 남기고 주소는 스택에서 줄인다', () => {
    const error = new Error('Cannot read properties of undefined')
    error.stack = 'Error: Cannot read\n    at save (http://localhost:4173/assets/index-abc.js:1:200)'
    const entry = recordError(error, 'react')
    expect(entry).toMatchObject({ source: 'react', message: 'Cannot read properties of undefined', page: 'journal', platform: 'web', count: 1 })
    expect(entry.stack).toContain('at save (/assets/index-abc.js:1:200)')
    expect(entry.stack).not.toContain('localhost')
    expect(readErrorLog()).toHaveLength(1)
  })

  it('같은 화면에서 같은 오류가 이어지면 횟수만 늘린다', () => {
    recordError(new Error('같은 오류'))
    recordError(new Error('같은 오류'))
    recordError('다른 오류')
    const list = readErrorLog()
    expect(list.map((item) => [item.message, item.count])).toEqual([
      ['다른 오류', 1],
      ['같은 오류', 2],
    ])
  })

  it('최근 30개까지만 두고, 긴 메시지는 자른다', () => {
    for (let i = 0; i < 35; i += 1) recordError(`오류 ${i} ${'x'.repeat(400)}`)
    const list = readErrorLog()
    expect(list).toHaveLength(30)
    expect(list[0].message.startsWith('오류 34')).toBe(true)
    expect(list[0].message.length).toBe(300)
  })

  it('보내는 함수가 있으면 보내고, 보내다 실패해도 기기에는 남는다', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'))
    setErrorSender(send)
    recordError(new Error('보내기 시험'))
    await Promise.resolve()
    await Promise.resolve()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ message: '보내기 시험', page: 'journal' }))
    expect(readErrorLog()[0].message).toBe('보내기 시험')
  })

  it('문의용 글로 만들고, 지울 수 있다', () => {
    recordError(new Error('복사 시험'), 'window')
    expect(formatErrorLog()).toContain('복사 시험')
    expect(formatErrorLog()).toContain('#journal (window, 1회)')
    clearErrorLog()
    expect(readErrorLog()).toEqual([])
  })
})
