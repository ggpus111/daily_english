import { todayItem } from './packs'
import { local } from './storage'

/** 오늘의 표현을 "다른 표현"으로 몇 번 넘겼는지(그날·그 기분 기준). 일기와 홈이 같은 표현을 보여 주게 이 기기에 남긴다. */
const MISSION_KEY = 'todayMissionTurn'
const dayKeyOf = (now) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`

export function readMissionTurn(mood = '', now = new Date()) {
  const saved = local.getJson(MISSION_KEY)
  return saved && saved.day === dayKeyOf(now) && saved.mood === mood ? saved.turn : 0
}

export const saveMissionTurn = (mood, turn, now = new Date()) =>
  local.set(MISSION_KEY, JSON.stringify({ day: dayKeyOf(now), mood, turn }))

/**
 * 공부 목적(일상·비즈니스·학업). 첫 실행 안내와 설정에서 고르고, 이 기기에 남긴다.
 * 고른 목적에 맞춰 처음 담아 볼 말, 단어 꾸러미의 첫 단계, 오늘의 표현을 고른다.
 * 지금은 영어 꾸러미에만 일·공부 표현과 단어가 있어서, 다른 언어는 늘 일상으로 본다.
 */
export const PURPOSES = ['daily', 'business', 'study']
export const PURPOSE_KEY = 'purpose'

/** 목적마다 쓰는 표현 꾸러미(analysis/native/talk_draft.json의 work, study)와 단어 단계(words_draft.json). */
export const PURPOSE_PACKS = { business: 'work', study: 'study' }
const PURPOSE_WORD_LEVELS = { business: 'business', study: 'study' }
const PURPOSE_ONLY_PACKS = new Set(Object.values(PURPOSE_PACKS))

export function readPurpose() {
  const saved = local.get(PURPOSE_KEY)
  return PURPOSES.includes(saved) ? saved : 'daily'
}

export const savePurpose = (purpose) => local.set(PURPOSE_KEY, PURPOSES.includes(purpose) ? purpose : 'daily')

/** 단어 꾸러미에서 먼저 보여 줄 단계(일상은 첫 실행에서 고른 수준을 따른다). */
export const purposeWordLevel = (purpose) => PURPOSE_WORD_LEVELS[purpose] ?? null

/** 표현 꾸러미에서 먼저 열 꾸러미. */
export const purposePack = (purpose) => PURPOSE_PACKS[purpose] ?? null

/** 그 목적에 맞는 표현. 일상은 일·공부 꾸러미를 뺀 나머지, 비즈니스·학업은 그 꾸러미만. 없으면 전부. */
export function purposeItems(items, purpose) {
  const pack = PURPOSE_PACKS[purpose]
  const picked = pack ? items.filter((item) => item.group === pack) : items.filter((item) => !PURPOSE_ONLY_PACKS.has(item.group))
  return picked.length > 0 ? picked : items
}

/**
 * 기분(src/lib/moods.js의 id)을 묶음으로 나눈다. 꾸러미 표현에는 묶음 이름이 붙어 있다(item.moods).
 * good 좋음, love 사랑·그리움, calm 차분·심심, tired 피곤·바쁨, worried 걱정·긴장, down 우울·속상
 */
const FAMILIES = {
  good: ['happy', 'excited', 'proud', 'hopeful', 'relieved', 'grateful'],
  love: ['loved', 'miss', 'jealous'],
  calm: ['calm', 'comfortable', 'bored', 'sleepy'],
  tired: ['tired', 'busy', 'sick'],
  worried: ['stressed', 'nervous', 'worried', 'confused', 'embarrassed'],
  down: ['sad', 'lonely', 'upset', 'angry'],
}
const MOOD_FAMILY = Object.fromEntries(
  Object.entries(FAMILIES).flatMap(([family, moods]) => moods.map((mood) => [mood, family])),
)

export const moodFamily = (mood) => MOOD_FAMILY[mood] ?? null

const DAY_MS = 24 * 60 * 60 * 1000
const localDay = (now) => Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / DAY_MS)

// 같은 날, 같은 기분이면 같은 표현이 나오도록 문자열로 정하는 섞기 값(화면을 다시 그려도 바뀌지 않게).
function hash(text) {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/**
 * 오늘의 표현. 기분을 고르지 않았으면 목적에 맞는 표현 중 날마다 하나,
 * 골랐으면 그 기분 묶음이 붙은 표현 중 무작위로 하나(그날 그 기분에서는 같은 것). 맞는 표현이 없으면 목적 안에서 고른다.
 */
export function pickTodayExpression(items, { purpose = 'daily', mood = '', now = new Date(), turn = 0 } = {}) {
  if (!items?.length) return null
  const pool = purposeItems(items, purpose)
  const family = moodFamily(mood)
  const seed = hash(`${localDay(now)}|${purpose}|${mood}|${turn}`)
  // 기분을 안 골랐거나 기분 묶음이 없는 언어: 첫 표현은 날마다 하나, "다른 표현"을 누르면 목적 안에서 섞어 고른다.
  if (!family || !pool.some((item) => item.moods)) return turn === 0 ? todayItem(pool, now) : pool[seed % pool.length]
  // 기분에 맞는 표현을 자주(세 번에 두 번), 가끔은 목적 안의 다른 표현도 보여 줘서 늘 같은 몇 개만 나오지 않게 한다.
  const matching = pool.filter((item) => item.moods?.includes(family))
  const choices = matching.length > 0 && seed % 3 !== 2 ? matching : pool
  return choices[Math.floor(seed / 3) % choices.length]
}

/** 첫 실행에서 담아 볼 추천: 목적 꾸러미 표현 앞쪽 몇 개와 목적 단어 몇 개. 일상이면 null(기존 추천을 쓴다). */
export function purposeStarters(expressions, words, purpose, { expressionCount = 6, wordCount = 4 } = {}) {
  const pack = PURPOSE_PACKS[purpose]
  if (!pack) return null
  const level = PURPOSE_WORD_LEVELS[purpose]
  return [
    ...(expressions?.filter((item) => item.group === pack).slice(0, expressionCount) ?? []).map((item) => ({ ...item, kind: 'expression' })),
    ...(words?.filter((item) => item.group === level).slice(0, wordCount) ?? []).map((item) => ({ ...item, kind: 'word' })),
  ]
}
