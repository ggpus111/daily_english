const normalizeSearch = (value) => String(value ?? '').toLowerCase()

export function matchesQuery(query, values) {
  const needle = normalizeSearch(query).trim()
  if (!needle) return true
  return values.some((value) => normalizeSearch(value).includes(needle))
}

// 띄어쓰기와 끝의 문장부호는 채점에서 보지 않는다.
const normalizeAnswer = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[.!?。！？]+\s*$/, '')
    .replace(/\s+/g, '')

// "사려 깊은, 배려하는"처럼 뜻이 여러 개면 하나만 맞혀도 정답으로 본다.
export function isCorrectAnswer(input, answer) {
  const typed = normalizeAnswer(input)
  if (!typed) return false
  return [answer, ...String(answer).split(/[,;/]/)].map(normalizeAnswer).includes(typed)
}

export function shuffle(items) {
  const deck = [...items]
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}
