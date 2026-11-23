import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...args) => invoke(...args) } } }))

const { requestCorrection } = await import('./aiCorrection')

const later = (value, ms = 20) => new Promise((resolve) => setTimeout(() => resolve(value), ms))

beforeEach(() => {
  invoke.mockReset()
})

describe('requestCorrection', () => {
  it('성공하면 교정과 남은 횟수를 돌려준다', async () => {
    invoke.mockResolvedValue({ data: { feedback: '좋아요', remaining: 3 }, error: null })
    expect(await requestCorrection('prompt one')).toEqual({ feedback: '좋아요', remaining: 3 })
  })

  it('연타해도 요청은 한 번만 가고, 나머지는 pending으로 막는다', async () => {
    invoke.mockImplementation(() => later({ data: { feedback: '한 번', remaining: 4 }, error: null }))
    const results = await Promise.all([requestCorrection('same'), requestCorrection('same'), requestCorrection('same')])
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(results.filter((result) => result.feedback)).toHaveLength(1)
    expect(results.filter((result) => result.error === 'pending')).toHaveLength(2)
  })

  it('끝나면(실패해도) 다시 보낼 수 있다', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError', message: 'x' } })
    const first = await requestCorrection('again')
    expect(first).toEqual({ error: 'network', detail: 'FunctionsFetchError' })
    invoke.mockResolvedValueOnce({ data: { feedback: '두 번째', remaining: 1 }, error: null })
    expect(await requestCorrection('again')).toMatchObject({ feedback: '두 번째' })
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('요청을 보낼 때 시간 제한을 함께 건다', async () => {
    invoke.mockResolvedValue({ data: { feedback: 'ok', remaining: 1 }, error: null })
    await requestCorrection('timeout check')
    expect(invoke).toHaveBeenCalledWith('correct-journal', expect.objectContaining({ timeout: 60_000 }))
  })

  it('서버가 보낸 오류 번호를 알맞은 종류로 바꾼다', async () => {
    const fail = (status, body) =>
      invoke.mockResolvedValueOnce({ data: null, error: { context: { status, json: async () => body } } })
    fail(401, { error: 'login' })
    expect((await requestCorrection('p')).error).toBe('login')
    fail(429, { error: 'limit' })
    expect((await requestCorrection('p')).error).toBe('limit')
    fail(503, { error: 'busy' })
    expect((await requestCorrection('p')).error).toBe('busy')
    fail(502, { error: 'ai', upstream: 404, reason: 'NOT_FOUND' })
    expect(await requestCorrection('p')).toEqual({ error: 'failed', detail: '502 ai 404 NOT_FOUND' })
  })
})
