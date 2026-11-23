import { describe, expect, it } from 'vitest'
import {
  buildCorrectionPrompt,
  fixToExpression,
  parseFeedback,
  recentPracticeNotes,
  recentWordTexts,
} from './correction'

const base = {
  uiLang: 'ko',
  learning: '영어',
  explain: '한국어',
  native: '어제 공원을 걸었다.',
  translation: 'I walked at the park yesterday.',
}

describe('buildCorrectionPrompt', () => {
  it('역할, 지킬 점, 답 형식, 예시, 내 글을 이 순서로 담는다', () => {
    const prompt = buildCorrectionPrompt(base)
    const order = ['[역할]', '[지켜 주세요]', '[답 형식]', '[답 예시]', '[일기]', '[내 번역]'].map((title) =>
      prompt.indexOf(title),
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(prompt).toContain(
      '## 고친 문장\n## 고칠 점\n## 더 자연스러운 표현\n## 문법 포인트\n## 잘한 점\n## 연습할 점',
    )
    expect(prompt.endsWith('[내 번역]\nI walked at the park yesterday.')).toBe(true)
  })

  it('일기와 번역의 특수 문자를 그대로 넣는다', () => {
    const prompt = buildCorrectionPrompt({
      ...base,
      native: '오늘 {날씨}가 좋았다.',
      translation: 'It was nice $& today.',
    })
    expect(prompt).toContain('[일기]\n오늘 {날씨}가 좋았다.')
    expect(prompt).toContain('[내 번역]\nIt was nice $& today.')
  })

  it('지난 연습할 점과 최근 단어가 있을 때만 넣는다', () => {
    expect(buildCorrectionPrompt(base)).not.toContain('[참고:')
    const prompt = buildCorrectionPrompt({ ...base, practiceNotes: ['과거형 연습'], recentWords: ['break the ice'] })
    expect(prompt).toContain('[참고: 지난 교정에서 연습하기로 한 점]\n- 과거형 연습')
    expect(prompt).toContain('[참고: 최근 모은 단어]\nbreak the ice')
  })

  it('예시 답은 앱이 다시 읽을 수 있는 형식이다', () => {
    const prompt = buildCorrectionPrompt(base)
    const example = prompt.slice(prompt.indexOf('[답 예시]'), prompt.indexOf('[일기]'))
    const parsed = parseFeedback(example)
    expect(parsed.corrected).toBe('Today I went to a cafe with my friend.')
    expect(parsed.fixes).toHaveLength(3)
    expect(parsed.natural).toHaveLength(2)
    expect(parsed.natural[0].text).toBe('I hung out at a cafe with my friend.')
    expect(parsed.grammar).toEqual([
      {
        text: '과거형(지난 일)',
        meaning: '이미 한 일은 동사를 과거형으로 써요.',
        example: 'I watched a movie yesterday.',
        exampleNative: '나는 어제 영화를 봤다.',
      },
    ])
  })

  it('영어 화면에서는 영어 제목을 쓴다', () => {
    const prompt = buildCorrectionPrompt({ ...base, uiLang: 'en', learning: 'English', explain: 'English' })
    expect(prompt).toContain(
      '## Corrected translation\n## Fixes\n## More natural ways\n## Grammar points\n## What went well\n## Practice next',
    )
  })
})

describe('parseFeedback', () => {
  it('정해진 제목과 고칠 점 줄을 나눈다', () => {
    const parsed = parseFeedback(`좋아요! 교정해 볼게요.

## 고친 문장
I walked in the park yesterday.

## 고칠 점
- 원래: at the park → 고침: in the park | 이유: 공원 안을 걸었으니 in이 자연스러워요.
- 시간 표현은 문장 끝에 두면 자연스러워요.

## 잘한 점
과거형을 잘 썼어요.

## 연습할 점
장소 전치사 in과 at을 구분해 보세요.`)
    expect(parsed).toEqual({
      corrected: 'I walked in the park yesterday.',
      fixes: [
        { original: 'at the park', fixed: 'in the park', reason: '공원 안을 걸었으니 in이 자연스러워요.' },
        { text: '시간 표현은 문장 끝에 두면 자연스러워요.' },
      ],
      // 예전 교정(더 자연스러운 표현 칸이 없던 때)도 그대로 읽는다.
      natural: [],
      grammar: [],
      good: '과거형을 잘 썼어요.',
      practice: '장소 전치사 in과 at을 구분해 보세요.',
    })
  })

  it('굵은 글씨, 번호, 콜론, 화살표 모양이 달라도 읽는다', () => {
    const parsed = parseFeedback(`**1. 고친 문장:**
I walked in the park.
### 2) 고칠 점
* **원래:** at -> **고침:** in
- 없음
**연습할 점**
전치사`)
    expect(parsed.corrected).toBe('I walked in the park.')
    expect(parsed.fixes).toEqual([{ original: 'at', fixed: 'in', reason: '' }])
    expect(parsed.practice).toBe('전치사')
  })

  it('형식을 안 지킨 답은 null이라 글 그대로 보여 준다', () => {
    expect(parseFeedback('at the park 대신 in the park가 자연스러워요.')).toBeNull()
    expect(parseFeedback('## 잘한 점\n좋아요')).toBeNull()
    expect(parseFeedback('')).toBeNull()
  })
})

describe('컨텍스트 고르기', () => {
  const feedback = (practice) => `## 고친 문장\nHi.\n## 연습할 점\n${practice}`

  it('지금 고치는 일기를 빼고 최근 연습할 점 두 개를 고른다', () => {
    const journals = [
      { id: 'now', aiFeedback: feedback('지금 것') },
      { id: 'a', aiFeedback: feedback('첫째') },
      { id: 'b', aiFeedback: '형식 없는 교정' },
      { id: 'c', aiFeedback: feedback('둘째') },
      { id: 'd', aiFeedback: feedback('셋째') },
    ]
    expect(recentPracticeNotes(journals, 'now')).toEqual(['첫째', '둘째'])
  })

  it('최근 단어는 빈 값을 빼고 다섯 개까지', () => {
    const words = ['a', ' ', 'b', 'c', 'd', 'e', 'f'].map((text) => ({ text }))
    expect(recentWordTexts(words)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('고칠 점을 표현으로 담기', () => {
  const corrected = 'Today I went to a cafe. It was fun with my friend.'

  it('고친 말이 표현, 원래 말과 이유가 뜻, 그 말이 든 문장이 예문이 된다', () => {
    const fix = { original: 'with friend', fixed: 'with my friend', reason: 'my를 붙이면 자연스러워요.' }
    expect(fixToExpression(fix, corrected, '원래 쓴 말')).toEqual({
      text: 'with my friend',
      meaning: '원래 쓴 말: with friend · my를 붙이면 자연스러워요.',
      example: 'It was fun with my friend.',
      source: 'journal',
    })
  })

  it('이유가 없거나 고친 문장에 그 말이 없어도 담을 수 있다', () => {
    const entry = fixToExpression({ original: 'go', fixed: 'visited', reason: '' }, corrected, '원래')
    expect(entry.meaning).toBe('원래: go')
    expect(entry.example).toBe('')
  })
})
