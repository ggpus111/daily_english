import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppContext } from '../context'
import { useRecordForm } from './useRecordForm'

const EMPTY_FORM = { text: '', meaning: '' }

function setup(overrides = {}) {
  const app = {
    t: (key) => key,
    notify: vi.fn(),
    add: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
  const wrapper = ({ children }) => <AppContext.Provider value={app}>{children}</AppContext.Provider>
  const { result } = renderHook(
    () => useRecordForm({ type: 'word', emptyForm: EMPTY_FORM, required: ['text'] }),
    { wrapper },
  )
  return { app, result }
}

const submitEvent = () => ({ preventDefault: vi.fn() })

describe('useRecordForm', () => {
  it('저장이 끝나기 전에 다시 제출해도 한 번만 저장한다', async () => {
    let finish
    const add = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({})
        }),
    )
    const { result } = setup({ add })

    act(() => result.current.setField('text', 'hello'))
    let first
    await act(async () => {
      first = result.current.submit(submitEvent())
      result.current.submit(submitEvent())
      result.current.submit(submitEvent())
    })
    expect(result.current.saving).toBe(true)
    await act(async () => {
      finish()
      await first
    })

    expect(add).toHaveBeenCalledTimes(1)
    expect(result.current.saving).toBe(false)
  })

  it('저장에 실패하면 입력 내용을 지우지 않는다', async () => {
    const { app, result } = setup({ add: vi.fn().mockResolvedValue({ error: 'offline' }) })

    act(() => result.current.setField('text', 'hello'))
    await act(() => result.current.submit(submitEvent()))

    expect(result.current.form.text).toBe('hello')
    expect(app.notify).toHaveBeenCalledWith('saveError')
  })

  it('양 끝 공백을 지우고 필수값이 비면 저장하지 않는다', async () => {
    const { app, result } = setup()

    act(() => result.current.setField('text', '   '))
    await act(() => result.current.submit(submitEvent()))
    expect(app.add).not.toHaveBeenCalled()
    expect(result.current.errors.text).toBe('fieldRequired')

    act(() => result.current.setField('text', '  hi  '))
    await act(() => result.current.submit(submitEvent()))
    expect(app.add).toHaveBeenCalledWith('word', { text: 'hi', meaning: '' })
  })

  it('수정을 시작하면 폼 항목만 가져온다', () => {
    const { result } = setup()
    const item = { id: 'a', createdAt: 'now', text: 'hi', meaning: '안녕' }

    act(() => result.current.startEdit(item))

    expect(result.current.form).toEqual({ text: 'hi', meaning: '안녕' })
    expect(result.current.editingId).toBe('a')
  })
})
