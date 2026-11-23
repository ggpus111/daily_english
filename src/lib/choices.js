import { normalizeText, shuffle } from './text'

export const CHOICE_COUNT = 4

// 일기 교정에서 담은 표현은 뜻 칸이 "원래 쓴 말 · 이유"라 보기로 쓸 수 없다. 뜻이 있는 기록만 쓴다.
export const choicePool = (items) => items.filter((item) => item.source !== 'journal' && item.meaning?.trim())

/** 서로 다른 뜻이 보기 개수만큼은 있어야 객관식을 만들 수 있다. */
export const canMakeChoices = (pool) => new Set(pool.map((item) => normalizeText(item.meaning))).size >= CHOICE_COUNT

/** 정답 뜻 하나와 다른 기록의 뜻 몇 개를 섞어 돌려준다. 뜻이 겹치는 보기는 넣지 않고, 모자라면 null. */
export function buildChoices(card, pool, mix = shuffle) {
  const used = new Set([normalizeText(card.meaning)])
  const wrong = []
  for (const other of mix(pool)) {
    const key = normalizeText(other.meaning)
    if (other.id === card.id || used.has(key)) continue
    used.add(key)
    wrong.push(other.meaning)
    if (wrong.length === CHOICE_COUNT - 1) return mix([card.meaning, ...wrong])
  }
  return null
}
