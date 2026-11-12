import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

async function goTo(user, name) {
  const nav = screen.getByRole('navigation')
  await user.click(within(nav).getByRole('button', { name }))
}

describe('앱 흐름', () => {
  it('저장한 단어가 홈의 개수와 최근 목록에 나온다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await goTo(user, '단어장')
    await user.type(screen.getByLabelText('단어 / 표현'), 'thoughtful')
    await user.type(screen.getByLabelText('뜻'), '사려 깊은')
    await user.click(screen.getByRole('button', { name: '저장하기' }))
    expect(await screen.findByText('thoughtful')).toBeTruthy()

    await goTo(user, '홈')
    expect(screen.getByRole('button', { name: /저장한 단어\s*1/ })).toBeTruthy()
    expect(screen.getByText('사려 깊은')).toBeTruthy()
  })

  it('필수 입력이 비면 저장하지 않고 입력칸에 오류를 연결한다', async () => {
    const user = userEvent.setup()
    render(<App />)

    await goTo(user, '단어장')
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    const input = screen.getByLabelText('단어 / 표현')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const error = document.getElementById(input.getAttribute('aria-describedby'))
    expect(error.textContent).toBe('꼭 입력해 주세요.')
    expect(localStorage.getItem('savedWords')).toBeNull()
  })

  it('수정하면 id와 작성 시각을 유지하고 데이터에 섞지 않는다', async () => {
    const user = userEvent.setup()
    const word = { id: 'a', createdAt: '2026-01-01', text: 'hi', meaning: '안녕', example: '' }
    localStorage.setItem('savedWords', JSON.stringify([word]))
    render(<App />)

    await goTo(user, '단어장')
    await user.click(screen.getByRole('button', { name: '수정' }))
    await user.clear(screen.getByLabelText('뜻'))
    await user.type(screen.getByLabelText('뜻'), '반가워')
    await user.click(screen.getByRole('button', { name: '수정 완료' }))

    await screen.findByText('반가워')
    expect(JSON.parse(localStorage.getItem('savedWords'))).toEqual([{ ...word, meaning: '반가워' }])
  })

  it('없는 주소는 홈으로 보낸다', () => {
    window.location.hash = '#nowhere'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('반가워요')
  })
})
