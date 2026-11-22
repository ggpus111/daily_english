// 예문 속 단어를 빈칸으로 만든다(빈칸 채우기 퀴즈).
// 첫 낱말은 규칙 활용형(bored, tries, making, swimming)과 자주 쓰는 불규칙 동사(made, went)까지 찾는다.

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MAX_WORDS = 6

// 꾸러미 단어·표현에 나오는 불규칙 동사
const IRREGULAR = {
  bite: ['bit', 'bitten'], break: ['broke', 'broken'], bring: ['brought'], build: ['built'], buy: ['bought'],
  catch: ['caught'], come: ['came'], do: ['did', 'done', 'does'], drink: ['drank', 'drunk'], drive: ['drove', 'driven'],
  eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feel: ['felt'], find: ['found'], fly: ['flew', 'flown'],
  forget: ['forgot', 'forgotten'], forgive: ['forgave', 'forgiven'], get: ['got', 'gotten'], give: ['gave', 'given'],
  go: ['went', 'gone', 'goes'], grow: ['grew', 'grown'], have: ['had', 'has'], hear: ['heard'], hide: ['hid', 'hidden'],
  hold: ['held'], keep: ['kept'], know: ['knew', 'known'], leave: ['left'], lend: ['lent'], lose: ['lost'],
  make: ['made'], meet: ['met'], pay: ['paid'], ride: ['rode', 'ridden'], run: ['ran'], say: ['said'], see: ['saw', 'seen'],
  sell: ['sold'], send: ['sent'], sing: ['sang', 'sung'], sit: ['sat'], sleep: ['slept'], speak: ['spoke', 'spoken'],
  spend: ['spent'], stand: ['stood'], steal: ['stole', 'stolen'], swim: ['swam', 'swum'], take: ['took', 'taken'],
  teach: ['taught'], tear: ['tore', 'torn'], tell: ['told'], think: ['thought'], throw: ['threw', 'thrown'],
  understand: ['understood'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], win: ['won'], write: ['wrote', 'written'],
}

function firstWordPattern(word) {
  const lower = word.toLowerCase()
  const base = escape(word)
  const forms = [`${base}(?:s|es|ed|d|ing|er|est)?`]
  if (/e$/i.test(word)) forms.push(`${escape(word.slice(0, -1))}(?:ing|ed|er|est)`)
  if (/[^aeiou]y$/i.test(word)) forms.push(`${escape(word.slice(0, -1))}i(?:es|ed|er|est)`)
  // 짧은 자음-모음-자음 낱말은 끝 자음을 겹친다(swim → swimming, shop → shopping, hug → hugged)
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/i.test(word)) forms.push(`${base}${escape(word.slice(-1))}(?:ing|ed|er|est)`)
  forms.push(...(IRREGULAR[lower] ?? []).map(escape))
  return `(?:${forms.join('|')})`
}

/**
 * 문장에서 단어·표현(활용형 포함)을 찾는다. 빈칸 퀴즈와 "일기에 쓴 내 표현 찾기"가 함께 쓴다.
 * @returns {{ index: number, match: string } | null}
 */
// 일본어·중국어·한국어처럼 낱말 사이를 띄지 않거나 조사가 붙는 글은 글자 그대로 찾는다.
const NO_SPACE_SCRIPT = /[぀-ヿ㐀-鿿가-힯]/
// 한국어 표현은 어미가 바뀌어도 찾도록(보고 싶어요 → 보고 싶었어요) 끝의 "요"와 마지막 음절을 빼고 찾는다.
const KOREAN = /[가-힯]/
function koreanStem(text) {
  const plain = text.endsWith('요') ? text.slice(0, -1) : text
  return plain.length > 2 ? plain.slice(0, -1) : plain
}

export function findPhrase(phrase, sentence) {
  const text = String(phrase ?? '')
    .trim()
    .replace(/[.!?。！？]+$/, '')
  const target = String(sentence ?? '')
  if (!text || !target) return null

  if (NO_SPACE_SCRIPT.test(text)) {
    const needle = KOREAN.test(text) ? koreanStem(text) : text
    const index = target.toLowerCase().indexOf(needle.toLowerCase())
    if (index < 0) return null
    // 한국어는 찾은 자리부터 어절 끝까지를 답으로 본다(보고 싶어요 → 보고 싶었어요)
    const end = KOREAN.test(text) ? target.slice(index + needle.length).search(/[\s.,!?]|$/) : 0
    return { index, match: target.slice(index, index + needle.length + Math.max(0, end)) }
  }

  const words = text.split(/\s+/)
  if (words.length > MAX_WORDS) return null
  // 영어 외 라틴 문자 언어(스페인어·프랑스어)도 악센트 글자를 낱말의 일부로 보게 유니코드 기준으로 끊는다.
  const rest = words.slice(1).map(escape)
  const source = `(?<![\\p{L}\\p{N}'])${firstWordPattern(words[0])}${rest.length ? `\\s+${rest.join('\\s+')}` : ''}(?![\\p{L}\\p{N}'])`
  const match = new RegExp(source, 'iu').exec(target)
  return match ? { index: match.index, match: match[0] } : null
}

/**
 * @returns {{ before: string, answer: string, after: string } | null} 예문에서 단어를 찾지 못하면 null
 */
export function makeBlank(item) {
  const example = String(item?.example ?? '').trim()
  const found = findPhrase(item?.text, example)
  if (!found || found.match.length === example.replace(/[.!?]+$/, '').length) return null
  return {
    before: example.slice(0, found.index),
    answer: found.match,
    after: example.slice(found.index + found.match.length),
  }
}
