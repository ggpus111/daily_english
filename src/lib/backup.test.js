import { describe, expect, it } from 'vitest'
import { BackupError, parseBackup, planImport } from './backup'

const ID = '0b5f3f0e-8f8d-4c6e-9a43-3f1c2f0a1b2c'
const empty = () => ({ word: [], expression: [], chat: [], journal: [] })
const errorCode = (fn) => {
  try {
    fn()
  } catch (error) {
    return error instanceof BackupError ? error.code : 'other'
  }
  return null
}

describe('parseBackup', () => {
  it('이 앱이 내려받은 파일을 그대로 읽고 복습 일정도 이어 간다', () => {
    const file = {
      word: [
        {
          id: ID,
          createdAt: '2026-11-01T00:00:00.000Z',
          text: ' break the ice ',
          meaning: '어색함을 깨다',
          example: '',
          box: 2,
          dueAt: '2026-11-05T00:00:00.000Z',
        },
      ],
      expression: [],
      chat: [],
      journal: [{ id: 'not-a-uuid', createdAt: '2026-11-02T00:00:00.000Z', native: '일기', translation: '' }],
    }
    const { records, invalid } = parseBackup(JSON.stringify(file))
    expect(invalid).toBe(0)
    expect(records.word[0]).toMatchObject({ id: ID, text: 'break the ice', box: 2, dueAt: '2026-11-05T00:00:00.000Z' })
    // 서버 표 id는 uuid라 다른 형식은 새로 만든다.
    expect(records.journal[0].id).not.toBe('not-a-uuid')
    expect(records.journal[0].id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('원본 앱 저장 형식도 읽는다', () => {
    const file = {
      savedWords: [{ id: 1731400000000, word: 'legacy', meaning: '옛 단어' }],
      savedChats: [{ id: 1731400000001, situation: '카페', message: 'Hi', meaning: '안녕', category: '일상' }],
    }
    const { records } = parseBackup(JSON.stringify(file))
    expect(records.word[0]).toMatchObject({ text: 'legacy', meaning: '옛 단어' })
    expect(records.chat[0].category).toBe('daily')
    expect(records.word[0].createdAt).toBe(new Date(1731400000000).toISOString())
  })

  it('모르는 칸은 버리고, 형식이 틀리거나 필수 칸이 빈 항목은 센다', () => {
    const file = {
      word: [
        { text: 'ok', meaning: '좋아', isAdmin: true, user_id: 'someone' },
        { text: '', meaning: '빈 단어' },
        { text: { nested: true }, meaning: 'x' },
        { text: 'a'.repeat(501), meaning: '너무 김' },
        null,
      ],
    }
    const { records, invalid } = parseBackup(JSON.stringify(file))
    expect(records.word).toHaveLength(1)
    expect(records.word[0]).not.toHaveProperty('isAdmin')
    expect(records.word[0]).not.toHaveProperty('user_id')
    expect(invalid).toBe(4)
  })

  it('잘못된 복습 일정은 버리고 단어는 살린다', () => {
    const file = { word: [{ text: 'x', meaning: 'y', box: 99, dueAt: 'later' }] }
    const [item] = parseBackup(JSON.stringify(file)).records.word
    expect(item).not.toHaveProperty('box')
    expect(item).not.toHaveProperty('dueAt')
  })

  it('JSON이 아니거나 백업 형식이 아니면 알려 준다', () => {
    expect(errorCode(() => parseBackup('not json'))).toBe('notJson')
    expect(errorCode(() => parseBackup('[1,2]'))).toBe('notBackup')
    expect(errorCode(() => parseBackup('{"hello":1}'))).toBe('notBackup')
  })
})

describe('planImport', () => {
  it('같은 id와 같은 내용은 건너뛴다', () => {
    const existing = empty()
    existing.word = [{ id: ID, text: 'Hello', meaning: '안녕', createdAt: '2026-11-01T00:00:00.000Z' }]
    const incoming = empty()
    incoming.word = [
      { id: ID, text: 'other', meaning: 'x', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: crypto.randomUUID(), text: 'hello', meaning: '안녕', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: crypto.randomUUID(), text: 'new', meaning: '새 단어', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: crypto.randomUUID(), text: 'new', meaning: '새 단어', createdAt: '2026-11-01T00:00:00.000Z' },
    ]
    const plan = planImport(existing, incoming)
    expect(plan.added).toBe(1)
    expect(plan.duplicates).toBe(3)
    expect(plan.toAdd.word[0].text).toBe('new')
  })
})
