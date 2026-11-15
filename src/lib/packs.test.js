import { describe, expect, it } from 'vitest'
import { MOODS } from './moods'
import { chunks, frequencyLevel, isSaved, loadPackData, peekPackData, tatoebaUrl, toEntry, todayItem } from './packs'

const expressions = await loadPackData('expressions')
const words = await loadPackData('words')

describe('표현 꾸러미 데이터', () => {
  it('꾸러미 10개, 표현 400개, id가 겹치지 않는다', () => {
    expect(expressions.groups).toHaveLength(10)
    expect(expressions.items).toHaveLength(400)
    expect(new Set(expressions.items.map((item) => item.id)).size).toBe(400)
    for (const group of expressions.groups) expect(group.items).toHaveLength(40)
  })

  it('모든 표현에 뜻, 예문, 예문 해석, 말뭉치 빈도가 있다', () => {
    for (const item of expressions.items) {
      expect(item.text && item.meaning && item.example && item.exampleKo).toBeTruthy()
      expect(item.sentences).toBeGreaterThanOrEqual(5)
    }
  })

  it('같은 표현이 두 번 들어 있지 않다', () => {
    const texts = expressions.items.map((item) => item.text.toLowerCase().replace(/[.!?,]/g, ''))
    expect(new Set(texts).size).toBe(texts.length)
  })
})

describe('단어 꾸러미 데이터', () => {
  it('초급 300개, 중급 300개이고 단어와 id가 겹치지 않는다', () => {
    expect(words.groups.map((group) => [group.id, group.items.length])).toEqual([
      ['beginner', 300],
      ['intermediate', 300],
    ])
    expect(new Set(words.items.map((item) => item.id)).size).toBe(600)
    expect(new Set(words.items.map((item) => item.text)).size).toBe(600)
  })

  it('모든 단어에 뜻과 한영 예문이 있고, 예문에 그 단어가 들어 있다', () => {
    // 불규칙 활용형으로 들어 있는 예문
    const irregular = {
      tell: 'told', get: 'got', make: 'made', give: 'gave', find: 'found', write: 'wrote',
      win: 'won', catch: 'caught', cry: 'cried', sell: 'sold',
    }
    for (const item of words.items) {
      expect(item.text && item.meaning && item.example && item.exampleKo).toBeTruthy()
      // 활용형(living, tired)도 있으므로 앞 세 글자로 확인한다.
      expect(item.example.toLowerCase()).toContain(irregular[item.text] ?? item.text.toLowerCase().slice(0, 3))
    }
  })

  it('Tatoeba 예문에는 문장 번호가 있고, 4분의 3 이상이 Tatoeba 문장이다', () => {
    const fromTatoeba = words.items.filter((item) => item.tatoeba)
    expect(fromTatoeba.length).toBeGreaterThanOrEqual(450)
    for (const item of fromTatoeba) expect(Number.isInteger(item.tatoeba)).toBe(true)
    expect(tatoebaUrl(123)).toBe('https://tatoeba.org/sentences/show/123')
  })
})

describe('불러오기', () => {
  it('한 번 불러오면 같은 데이터를 바로 돌려준다', async () => {
    expect(peekPackData('words')).toBe(words)
    expect(await loadPackData('words')).toBe(words)
  })
})

describe('도우미', () => {
  it('오늘의 표현은 같은 날이면 같고, 다음 날이면 바뀐다', () => {
    const morning = new Date('2026-11-13T08:00:00')
    const night = new Date('2026-11-13T23:00:00')
    const tomorrow = new Date('2026-11-14T08:00:00')
    expect(todayItem(expressions.items, morning).id).toBe(todayItem(expressions.items, night).id)
    expect(todayItem(expressions.items, tomorrow).id).not.toBe(todayItem(expressions.items, morning).id)
  })

  it('담은 표현은 대소문자와 문장 부호가 달라도 알아본다', () => {
    const item = expressions.items.find((entry) => entry.text === "How's it going?")
    expect(isSaved(item, [{ text: 'how’s it going' }])).toBe(true)
    expect(isSaved(item, [{ text: 'how are you' }])).toBe(false)
  })

  it('빈도 단계, 기록으로 바꾸기, 50개씩 나누기', () => {
    expect(frequencyLevel(500)).toBe('often')
    expect(frequencyLevel(50)).toBe('common')
    expect(frequencyLevel(5)).toBe('sometimes')
    const word = words.items[0]
    expect(toEntry(word)).toEqual({ text: word.text, meaning: word.meaning, example: word.example })
    const parts = chunks(words.groups[0].items)
    expect(parts).toHaveLength(6)
    expect(parts[5]).toMatchObject({ from: 251, to: 300 })
    expect(chunks([1, 2, 3], 2).map((part) => part.items)).toEqual([[1, 2], [3]])
  })
})

describe('앱 성격에 맞는 콘텐츠', () => {
  // analysis/native/content_fit.py와 같은 기준의 최소한의 지킴이
  const dark = /\b(kill\w*|murder\w*|dead|death|gun\w*|war|prison\w*|crime\w*|drug\w*|attack\w*|enem\w+|arrest\w*|blood\w*|bomb\w*)\b/i

  it('단어와 예문에 죽음·폭력·범죄 낱말이 없다', () => {
    // 관용구 속에서는 어두운 뜻이 아니다(scared to death = 무서워 죽겠다, dying to = 몹시 ~하고 싶다).
    const idioms = /dying to|killing me|scared to death|kill two birds/gi
    for (const item of [...words.items, ...expressions.items]) {
      expect(dark.test(item.text.replace(idioms, '')), item.text).toBe(false)
      expect(dark.test(item.example.replace(idioms, '')), item.example).toBe(false)
    }
  })

  it('일기에 쓰는 기분 낱말이 단어 꾸러미에 들어 있다', () => {
    const texts = new Set(words.items.map((item) => item.text))
    for (const word of ['happy', 'sad', 'angry', 'tired', 'bored', 'excited', 'nervous', 'hungry', 'upset', 'proud', 'comfortable']) {
      expect(texts.has(word), word).toBe(true)
    }
  })

  it('단어 예문은 대부분 나나 너의 말이다', () => {
    const personal = words.items.filter((item) => /\b(i|i'm|me|my|we|our|us|you|your|let's)\b/i.test(item.example))
    expect(personal.length / words.items.length).toBeGreaterThan(0.9)
  })
})

describe('오늘의 기분', () => {
  it('기분 낱말은 모두 단어 꾸러미에 있는 낱말이고, 예문에 그 낱말이 들어 있다', () => {
    const texts = new Set(words.items.map((item) => item.text))
    for (const mood of MOODS) {
      expect(texts.has(mood.id), mood.id).toBe(true)
      expect(mood.sentence).toContain(mood.id)
      expect(mood.ko && mood.sentenceKo).toBeTruthy()
    }
  })
})
