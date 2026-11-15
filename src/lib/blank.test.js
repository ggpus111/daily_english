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

  it('예문이 없거나, 단어가 없거나, 예문 전체가 단어뿐이면 빈칸을 만들지 않는다', () => {
    expect(blankOf('mess', '')).toBeNull()
    expect(blankOf('mess', 'My room is clean.')).toBeNull()
    expect(blankOf('Take care', 'Take care.')).toBeNull()
    expect(blankOf('pick up', 'Can you pick me up at six?')).toBeNull()
  })
})
