// 표현·단어 꾸러미(analysis/native/build_packs.py, build_words.py가 만든 src/data/*.json)를 다룬다.
// 데이터는 처음 필요할 때 따로 불러온다. 첫 화면 코드에 함께 묶이지 않게 해서 앱이 빨리 뜨게 한다.

const LOADERS = {
  expressions: () => import('../data/packs.json'),
  words: () => import('../data/words.json'),
}

export const PACK_KINDS = Object.keys(LOADERS)
export const WORD_CHUNK = 50

const loaded = {}
const pending = {}

function prepare(kind, data) {
  const groups = kind === 'words' ? data.levels : data.packs
  const toItem = (group) => (item) => ({ ...item, text: item.text ?? item.word, group: group.id })
  const ready = groups.map((group) => ({ ...group, items: group.items.map(toItem(group)) }))
  return { source: data.source, groups: ready, items: ready.flatMap((group) => group.items) }
}

/** 이미 불러온 꾸러미가 있으면 바로 돌려준다(없으면 null). */
export const peekPackData = (kind) => loaded[kind] ?? null

/** 꾸러미를 불러온다. 한 번 불러오면 다시 받지 않고, 실패하면 다음 호출에서 다시 시도한다. */
export function loadPackData(kind) {
  if (loaded[kind]) return Promise.resolve(loaded[kind])
  pending[kind] ??= LOADERS[kind]().then(
    (module) => {
      loaded[kind] = prepare(kind, module.default)
      delete pending[kind]
      return loaded[kind]
    },
    (error) => {
      delete pending[kind]
      throw error
    },
  )
  return pending[kind]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 날마다 바뀌는 오늘의 항목. 기기 시간대의 날짜를 기준으로 정한다. */
export function todayItem(items, now = new Date()) {
  const localDay = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / DAY_MS)
  return items[localDay % items.length]
}

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?,]/g, '')
    .trim()

/** 이미 내 기록(단어장·표현 모음)에 담은 항목인지. */
export function isSaved(item, entries) {
  const key = normalize(item.text)
  return entries.some((entry) => normalize(entry.text) === key)
}

/** 공개 문장 100만 개당 쓰인 횟수로 얼마나 자주 쓰이는지 나눈다. */
export function frequencyLevel(perMillion) {
  if (perMillion >= 300) return 'often'
  if (perMillion >= 30) return 'common'
  return 'sometimes'
}

/** 꾸러미 항목을 단어장·표현 모음에 넣을 기록으로 바꾼다. */
export const toEntry = (item) => ({ text: item.text, meaning: item.meaning, example: item.example })

/** 단어 목록을 WORD_CHUNK개씩 나눈 범위. */
export function chunks(items, size = WORD_CHUNK) {
  const result = []
  for (let start = 0; start < items.length; start += size) {
    result.push({ index: result.length, from: start + 1, to: Math.min(start + size, items.length), items: items.slice(start, start + size) })
  }
  return result
}

/** Tatoeba 문장 원문 주소. */
export const tatoebaUrl = (id) => `https://tatoeba.org/sentences/show/${id}`
