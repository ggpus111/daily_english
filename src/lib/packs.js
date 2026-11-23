// 표현·단어 꾸러미(src/data/{배우는 언어}/packs.json, words.json)를 다룬다.
// 영어는 analysis/native, 다른 언어는 analysis/multilang이 만든다. 배우는 언어에 맞는 꾸러미를 보여 준다.
// 데이터는 처음 필요할 때 따로 불러온다. 첫 화면 코드에 함께 묶이지 않게 해서 앱이 빨리 뜨게 한다.

import { applyFixes, fetchPackFixes } from './packFixes'
import { normalizeText } from './text'

// 언어 폴더마다 파일을 따로 묶어, 고른 언어의 꾸러미만 받는다.
const FILES = import.meta.glob('../data/*/*.json')
const FILE_NAME = { expressions: 'packs', words: 'words' }
const loaderFor = (kind, lang) => FILES[`../data/${lang}/${FILE_NAME[kind]}.json`]

export const PACK_KINDS = Object.keys(FILE_NAME)

/** 이 언어의 꾸러미가 있는지(아직 만들지 않은 언어는 "준비 중"을 보여 준다). */
export const hasPackData = (kind, lang = 'en') => Boolean(loaderFor(kind, lang))
/** 외국인 연인·친구와의 대화 꾸러미(analysis/native/talk_draft.json). 꾸러미 화면에서 앞에 따로 묶는다. */
export const TALK_PACKS = ['love', 'miss', 'text', 'slang', 'chat', 'tease', 'date', 'call', 'fight', 'care', 'react', 'culture']
export const WORD_CHUNK = 50

const loaded = {}
const pending = {}

function prepare(kind, data, fixes = []) {
  const groups = kind === 'words' ? data.levels : data.packs
  const toItem = (group) => (item) => ({ ...item, text: item.text ?? item.word, group: group.id })
  const ready = groups.map((group) => ({ ...group, items: applyFixes(group.items.map(toItem(group)), fixes) }))
  return { source: data.source, groups: ready, items: ready.flatMap((group) => group.items) }
}

const cacheKey = (kind, lang) => `${kind}:${lang}`

/** 관리자가 고치기 전, 앱에 든 그대로의 꾸러미(관리자 페이지에서 원래 값과 비교할 때). */
export async function loadBasePackData(kind, lang = 'en') {
  const module = await loaderFor(kind, lang)()
  return prepare(kind, module.default)
}

/** 관리자가 고친 뒤 다음에 꾸러미를 열 때 새 고침을 받도록 비운다. */
export function forgetPackData(kind, lang = 'en') {
  delete loaded[cacheKey(kind, lang)]
}

/** 이미 불러온 꾸러미가 있으면 바로 돌려준다(없으면 null). */
export const peekPackData = (kind, lang = 'en') => loaded[cacheKey(kind, lang)] ?? null

/** 꾸러미를 불러온다(관리자 고침 포함). 한 번 불러오면 다시 받지 않고, 실패하면 다음 호출에서 다시 시도한다. */
export function loadPackData(kind, lang = 'en') {
  const key = cacheKey(kind, lang)
  if (loaded[key]) return Promise.resolve(loaded[key])
  const loader = loaderFor(kind, lang)
  if (!loader) return Promise.reject(new Error(`no ${kind} pack for ${lang}`))
  pending[key] ??= Promise.all([loader(), fetchPackFixes(kind)]).then(
    ([module, fixes]) => {
      loaded[key] = prepare(kind, module.default, fixes)
      delete pending[key]
      return loaded[key]
    },
    (error) => {
      delete pending[key]
      throw error
    },
  )
  return pending[key]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 날마다 바뀌는 오늘의 항목. 기기 시간대의 날짜를 기준으로 정한다. */
export function todayItem(items, now = new Date()) {
  const localDay = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / DAY_MS)
  return items[localDay % items.length]
}


/** 이미 내 기록(단어장·표현 모음)에 담은 항목인지. */
export function isSaved(item, entries) {
  const key = normalizeText(item.text)
  return entries.some((entry) => normalizeText(entry.text) === key)
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
