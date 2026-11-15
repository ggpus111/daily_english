import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorKind, errorMessage, isRetryable } from './errors'
import { createTranslator } from './i18n'

const t = createTranslator('ko')

describe('errorKind', () => {
  afterEach(() => vi.restoreAllMocks())

  it('연결이 끊겼으면 오프라인, 연결은 됐는데 못 닿으면 연결 실패', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(errorKind({ message: 'TypeError: Failed to fetch' })).toBe('offline')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(errorKind({ message: 'TypeError: Failed to fetch' })).toBe('connection')
    expect(errorKind({ name: 'AuthRetryableFetchError', message: '' })).toBe('connection')
  })

  it('시간 초과와 서버 오류를 구분한다', () => {
    expect(errorKind({ name: 'TimeoutError', message: 'signal timed out' })).toBe('timeout')
    expect(errorKind({ message: 'AbortError: signal is aborted without reason' })).toBe('timeout')
    expect(errorKind({ message: 'oops', status: 503 })).toBe('server')
    expect(errorKind('502 Bad Gateway')).toBe('server')
    expect(errorKind({ name: 'AuthRetryableFetchError', message: '{}', status: 503 })).toBe('server')
  })

  it('입력 오류 같은 다른 오류는 그대로 둔다', () => {
    expect(errorKind({ message: 'new row violates row-level security policy', status: 403 })).toBeNull()
    expect(isRetryable({ message: 'duplicate key' })).toBe(false)
  })
})

describe('errorMessage', () => {
  it('알아본 오류는 쉬운 말로, 나머지는 받은 문구로', () => {
    expect(errorMessage({ message: 'x', status: 500 }, t)).toBe(t('errServer'))
    expect(errorMessage({ message: 'duplicate key' }, t)).toBe('duplicate key')
    expect(errorMessage('not found', t)).toBe('not found')
    expect(errorMessage({}, t)).toBe(t('errUnknown'))
  })
})
