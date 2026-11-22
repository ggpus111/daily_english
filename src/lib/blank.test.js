import { describe, expect, it } from 'vitest'
import { makeBlank } from './blank'

const blankOf = (text, example) => makeBlank({ text, example })

describe('빈칸 만들기', () => {
  it('예문 속 단어를 빈칸으로 만들고 앞뒤 문장을 나눈다', () => {
    expect(blankOf('thoughtful', 'It was a thoughtful gift.')).toEqual({
      before: 'It was a ',
      answer: 'thoughtful',
      after: ' gift.',
    })
  })

  it('규칙 활용형, 자음 겹침, 불규칙 동사도 찾는다', () => {
    expect(blankOf('bore', 'I was bored at home.').answer).toBe('bored')
    expect(blankOf('try', 'He tried his best.').answer).toBe('tried')
    expect(blankOf('make', 'We are making kimbap.').answer).toBe('making')
    expect(blankOf('swim', 'I joined the swimming club.').answer).toBe('swimming')
    expect(blankOf('go', 'I went to school.').answer).toBe('went')
    expect(blankOf('fall asleep', 'I fell asleep on the sofa.').answer).toBe('fell asleep')
  })

  it('여러 낱말 표현과 대소문자, 문장 부호가 붙은 표현도 찾는다', () => {
    expect(blankOf('hang out', 'Do you want to hang out later?').answer).toBe('hang out')
    expect(blankOf("How's it going?", "Hey, how's it going?").answer).toBe("how's it going")
    expect(blankOf('Sounds good.', 'Pizza at seven? — Sounds good.').answer).toBe('Sounds good')
  })

  it('다른 낱말 속 글자는 잡지 않는다', () => {
    expect(blankOf('car', 'I pushed the cart.')).toBeNull()
    expect(blankOf('cat', 'Let me educate you.')).toBeNull()
  })

  it('일본어·중국어는 띄어쓰기 없이 글자 그대로 찾는다', () => {
    expect(blankOf('会いたい', '本当に会いたいよ。')).toEqual({ before: '本当に', answer: '会いたい', after: 'よ。' })
    expect(blankOf('想你', '我好想你啊。').answer).toBe('想你')
  })

  it('한국어는 어미가 바뀌어도 어절 끝까지 찾는다', () => {
    expect(blankOf('보고 싶어요', '오늘 너무 보고 싶었어요.').answer).toBe('보고 싶었어요')
  })

  it('스페인어·프랑스어는 악센트 글자를 낱말의 일부로 본다', () => {
    expect(blankOf('mañana', 'Nos vemos mañana.').answer).toBe('mañana')
    expect(blankOf('été', "C'était un bel été.").answer).toBe('été')
    expect(blankOf('ver', 'Quiero verte.')).toBeNull()
  })

  it('예문이 없거나, 단어가 없거나, 예문 전체가 단어뿐이면 빈칸을 만들지 않는다', () => {
    expect(blankOf('mess', '')).toBeNull()
    expect(blankOf('mess', 'My room is clean.')).toBeNull()
    expect(blankOf('Take care', 'Take care.')).toBeNull()
    expect(blankOf('pick up', 'Can you pick me up at six?')).toBeNull()
  })
})
