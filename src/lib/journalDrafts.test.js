import { beforeEach, describe, expect, it } from 'vitest'
import {
  JOURNAL_DRAFTS_KEY,
  MAX_DRAFTS,
  addDraft,
  clearDrafts,
  draftTitle,
  hasDraftText,
  loadDrafts,
  putBackDraft,
  removeDraft,
} from './journalDrafts'

const form = (native, extra = {}) => ({ mood: '', native, translation: '', aiFeedback: '', memo: '', ...extra })

beforeEach(() => {
  window.localStorage.clear()
})

describe('hasDraftText', () => {
  it('글이 하나라도 있으면 참, 기분만 고른 것이나 공백뿐인 것은 거짓', () => {
    expect(hasDraftText(form('오늘은 비가 왔다'))).toBe(true)
    expect(hasDraftText(form('', { memo: '메모만' }))).toBe(true)
    expect(hasDraftText(form('   ', { mood: 'happy' }))).toBe(false)
    expect(hasDraftText(null)).toBe(false)
  })
})

describe('임시저장함', () => {
  it('글이 없으면 저장하지 않는다', () => {
    expect(addDraft(form(''))).toBeNull()
    expect(loadDrafts()).toEqual([])
  })

  it('새 임시저장이 맨 위에 쌓인다', () => {
    addDraft(form('첫째'), new Date('2026-11-24T01:00:00Z'))
    const list = addDraft(form('둘째'), new Date('2026-11-24T02:00:00Z'))
    expect(list.map((item) => item.form.native)).toEqual(['둘째', '첫째'])
    expect(loadDrafts()).toHaveLength(2)
  })

  it('가득 차면 가장 오래된 것부터 밀려난다', () => {
    for (let i = 0; i < MAX_DRAFTS + 3; i++) addDraft(form(`글 ${i}`), new Date(2026, 10, 24, 1, i))
    const list = loadDrafts()
    expect(list).toHaveLength(MAX_DRAFTS)
    expect(list[0].form.native).toBe(`글 ${MAX_DRAFTS + 2}`)
    expect(list.at(-1).form.native).toBe('글 3')
  })

  it('지우고, 되돌리면 원래 시각 순서 자리로 돌아온다', () => {
    addDraft(form('가'), new Date('2026-11-24T01:00:00Z'))
    addDraft(form('나'), new Date('2026-11-24T02:00:00Z'))
    addDraft(form('다'), new Date('2026-11-24T03:00:00Z'))
    const middle = loadDrafts()[1]
    expect(middle.form.native).toBe('나')
    expect(removeDraft(middle.id).map((item) => item.form.native)).toEqual(['다', '가'])
    expect(putBackDraft(middle).map((item) => item.form.native)).toEqual(['다', '나', '가'])
  })

  it('저장소가 망가져 있어도 빈 목록으로 읽는다', () => {
    window.localStorage.setItem(JOURNAL_DRAFTS_KEY, '{이건 JSON이 아님')
    expect(loadDrafts()).toEqual([])
    window.localStorage.setItem(JOURNAL_DRAFTS_KEY, JSON.stringify([{ id: 1 }, null, 'x']))
    expect(loadDrafts()).toEqual([])
  })

  it('clearDrafts가 모두 지운다', () => {
    addDraft(form('가'))
    clearDrafts()
    expect(loadDrafts()).toEqual([])
  })
})

describe('draftTitle', () => {
  it('본문 첫 줄을 쓰고, 길면 자른다', () => {
    expect(draftTitle(form('첫 줄\n둘째 줄'))).toBe('첫 줄')
    expect(draftTitle(form('가'.repeat(50)), 10)).toBe(`${'가'.repeat(10)}…`)
  })

  it('본문이 없으면 번역, 메모 순으로 쓴다', () => {
    expect(draftTitle(form('', { translation: 'I miss you' }))).toBe('I miss you')
    expect(draftTitle(form('', { memo: '메모' }))).toBe('메모')
    expect(draftTitle(form(''))).toBe('')
  })
})
