import { afterEach, describe, expect, it, vi } from 'vitest'
import { REQUEST_TIMEOUT_MS, fetchWithTimeout } from './supabase'

describe('fetchWithTimeout', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('요청마다 시간 제한 신호를 붙인다', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetch)
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    await fetchWithTimeout('https://example.com', { method: 'GET' })
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS)
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(fetch.mock.calls[0][1].method).toBe('GET')
  })

  it('호출한 쪽이 취소하면 함께 취소된다', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    await fetchWithTimeout('https://example.com', { signal: controller.signal })
    const signal = fetch.mock.calls[0][1].signal
    expect(signal.aborted).toBe(false)
    controller.abort()
    expect(signal.aborted).toBe(true)
  })
})
