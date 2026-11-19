const normalizeSearch = (value) => String(value ?? '').toLowerCase()

/** 같은 말인지 비교할 때 쓰는 형태: 소문자, 곧은 따옴표, 문장 부호와 앞뒤 공백 없음 */
export const normalizeText = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?,]/g, '')
    .trim()

export function matchesQuery(query, values) {
  const needle = normalizeSearch(query).trim()
  if (!needle) return true
  return values.some((value) => normalizeSearch(value).includes(needle))
}

// 띄어쓰기, 끝의 문장부호, 괄호 속 설명("(a lot) 많이")은 채점에서 보지 않는다.
const normalizeAnswer = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\([^)]*\)/g, '')
    .replace(/[.!?。！？]+\s*$/, '')
    .replace(/\s+/g, '')

// "사려 깊은, 배려하는"처럼 뜻이 여러 개면 하나만 맞혀도 정답으로 본다.
export function isCorrectAnswer(input, answer) {
  const typed = normalizeAnswer(input)
  if (!typed) return false
  return [answer, ...String(answer).split(/[,;/·]/)].map(normalizeAnswer).includes(typed)
}

export function shuffle(items) {
  const deck = [...items]
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}
