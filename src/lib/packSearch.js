// 꾸러미(표현·단어·문법) 전체에서 말을 찾는다. 친구가 보낸 모르는 말(예: lowkey)이나 우리말 뜻(예: 어색한)으로 찾는다.
// 묶음을 하나씩 눌러 볼 필요 없이 바로 찾게 하려고 만들었다(docs/usability-ai-check.md 1번).

/** 비교용 형태: 소문자, 아포스트로피·문장 부호·여러 칸 띄어쓰기 없음(youre로 써도 You're를 찾게) */
export const normalizeQuery = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[.!?,;:"“”()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// 점수가 높을수록 위에 보인다. 0이면 맞지 않는 것.
function score(item, needle) {
  const text = normalizeQuery(item.text)
  if (!text) return 0
  if (text === needle) return 100
  if (text.startsWith(needle)) return 80
  if (` ${text} `.includes(` ${needle} `)) return 70 // 낱말 단위로 들어 있음(예: "trip" → "Don't trip")
  if (text.includes(needle)) return 60
  if (normalizeQuery(item.meaning).includes(needle)) return 40
  if (normalizeQuery(item.tip).includes(needle)) return 15
  if (normalizeQuery(item.example).includes(needle)) return 10
  return 0
}

/**
 * @param {{ kind: 'expressions' | 'words' | 'grammar', data: { groups: object[] } | null }[]} sources 불러온 꾸러미
 * @param {string} query 찾을 말
 * @param {number} limit 보여 줄 개수
 * @returns {{ results: { kind: string, group: object, item: object }[], total: number }}
 */
export function searchPacks(sources, query, limit = 20) {
  const needle = normalizeQuery(query)
  if (!needle) return { results: [], total: 0 }
  const found = []
  const seen = new Set()
  for (const { kind, data } of sources) {
    if (!data) continue
    for (const group of data.groups) {
      for (const item of group.items) {
        const points = score(item, needle)
        if (!points) continue
        // 같은 말이 두 묶음에 있으면 한 번만 보여 준다.
        const key = `${kind}:${normalizeQuery(item.text)}`
        if (seen.has(key)) continue
        seen.add(key)
        found.push({ kind, group, item, points })
      }
    }
  }
  // 점수가 같으면 짧은 말(더 기본적인 말)을 먼저
  found.sort((a, b) => b.points - a.points || a.item.text.length - b.item.text.length)
  return { results: found.slice(0, limit).map(({ kind, group, item }) => ({ kind, group, item })), total: found.length }
}
