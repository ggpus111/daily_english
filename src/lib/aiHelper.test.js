import { describe, expect, it } from 'vitest'
import { MAX_HELPER_TEXT, buildExplainPrompt, buildPolishPrompt, buildWeeklyReportPrompt, weekJournals } from './aiHelper'

const langs = { learning: 'English', explain: '한국어' }

describe('보내기 전 다듬기', () => {
  it('말투 세 가지와 설명 언어를 요청하고, 보낼 말을 그대로 넣는다', () => {
    const prompt = buildPolishPrompt({ ...langs, text: '  오늘 너무 보고 싶었어  ' })
    expect(prompt).toContain('warm and sweet')
    expect(prompt).toContain('playful')
    expect(prompt).toContain('in 한국어')
    expect(prompt).toContain('오늘 너무 보고 싶었어\n"""')
  })

  it('너무 긴 말은 잘라서 보낸다', () => {
    const prompt = buildPolishPrompt({ ...langs, text: '가'.repeat(MAX_HELPER_TEXT + 100) })
    expect(prompt).toContain('가'.repeat(MAX_HELPER_TEXT))
    expect(prompt).not.toContain('가'.repeat(MAX_HELPER_TEXT + 1))
  })
})

describe('받은 메시지 풀이', () => {
  it('뜻, 슬랭, 말투, 답장 예시를 요청한다', () => {
    const prompt = buildExplainPrompt({ ...langs, text: 'ngl ur kinda cute lol' })
    expect(prompt).toContain('slang')
    expect(prompt).toContain('mood and intent')
    expect(prompt).toContain('Two natural replies in English')
    expect(prompt).toContain('ngl ur kinda cute lol')
  })
})

describe('주간 리포트', () => {
  const today = new Date('2026-11-24T12:00:00')
  const entry = (day, extra = {}) => ({
    createdAt: new Date(`2026-11-${day}T09:00:00`).toISOString(),
    native: `${day}일 일기`,
    translation: `entry ${day}`,
    aiFeedback: '',
    ...extra,
  })

  it('오늘 포함 7일 안의, 번역이 있는 일기만 오래된 것부터 고른다', () => {
    const picked = weekJournals(
      [entry('24'), entry('17'), entry('18'), entry('20', { translation: '  ' }), entry('22')],
      today,
    )
    expect(picked.map((item) => item.native)).toEqual(['18일 일기', '22일 일기', '24일 일기'])
  })

  it('일기와 받은 교정을 담고, 너무 길면 뒤의 것은 뺀다', () => {
    const prompt = buildWeeklyReportPrompt({
      ...langs,
      journals: [entry('22', { aiFeedback: '고칠 점: so much' }), entry('23', { translation: 'x'.repeat(9500) })],
    })
    expect(prompt).toContain('Entry 1')
    expect(prompt).toContain('Correction I received:\n고칠 점: so much')
    expect(prompt).not.toContain('Entry 2')
  })
})
