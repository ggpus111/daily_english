import { describe, expect, it } from 'vitest'
import { buildGrammarCheckPrompt, modesFor, parseGrammarCheck } from './grammar'

const note = { text: 'used to + 동사원형', meaning: '예전에는 ~하곤 했다(지금은 아님)' }

describe('modesFor', () => {
  it('예문과 해석이 다 있을 때만 번역 연습을 낸다', () => {
    expect(modesFor({ ...note, example: 'I used to swim.', exampleNative: '나는 수영하곤 했다.' })).toEqual([
      'translate',
      'compose',
    ])
    expect(modesFor({ ...note, example: 'I used to swim.' })).toEqual(['compose'])
    expect(modesFor(note)).toEqual(['compose'])
  })
})

describe('buildGrammarCheckPrompt', () => {
  it('역할, 할 일, 지킬 점, 답 형식, 문법, 내 문장을 이 순서로 담는다', () => {
    const prompt = buildGrammarCheckPrompt({
      uiLang: 'ko',
      learning: '영어',
      explain: '한국어',
      note,
      mode: 'translate',
      source: '나는 예전에 축구를 하곤 했다.',
      answer: 'I used to playing soccer.',
    })
    const order = ['[역할]', '[할 일]', '[지켜 주세요]', '[답 형식]', '[문법]', '[내 문장]'].map((title) =>
      // "[문법]"은 할 일 문장 안에도 나와서, 따로 선 줄로 찾는다.
      prompt.indexOf(title === '[문법]' ? '\n[문법]\n' : title),
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(prompt).toContain('우리말: 나는 예전에 축구를 하곤 했다.')
    expect(prompt).toContain('## 결과\n## 고친 문장\n## 설명')
    expect(prompt.endsWith('[내 문장]\nI used to playing soccer.')).toBe(true)
  })

  it('작문 연습은 우리말 없이 문법만 준다', () => {
    const prompt = buildGrammarCheckPrompt({
      uiLang: 'en',
      learning: 'English',
      explain: 'English',
      note,
      mode: 'compose',
      answer: 'x',
    })
    expect(prompt).toContain('using [Grammar]')
    expect(prompt).not.toContain('Text:')
  })
})

describe('parseGrammarCheck', () => {
  it('결과, 고친 문장, 설명을 나눈다', () => {
    const parsed = parseGrammarCheck(
      '## 결과\n고칠 점 있어요\n## 고친 문장\nI used to play soccer.\n## 설명\nused to 뒤에는 동사원형을 써요.',
    )
    expect(parsed).toEqual({ ok: false, corrected: 'I used to play soccer.', why: 'used to 뒤에는 동사원형을 써요.' })
  })

  it('굵은 글씨와 영어 제목도 읽고, 맞았으면 ok', () => {
    const parsed = parseGrammarCheck(
      '### **Result**\n**Correct**\n### Corrected sentence\nI used to swim.\n### Explanation\nNice.',
    )
    expect(parsed.ok).toBe(true)
  })

  it('형식이 아니면 null', () => {
    expect(parseGrammarCheck('그냥 잘했어요!')).toBeNull()
    expect(parseGrammarCheck('')).toBeNull()
  })
})
