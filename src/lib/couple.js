// 연인과 오늘의 한 문장 주고받기(supabase/schema.sql의 couples, couple_members, couple_sentences).
import { dayKey } from './activity'
import { TALK_PACKS, todayItem } from './packs'
import { supabase } from './supabase'
import { failure } from './errors'

export const SENTENCE_MAX = 300
export const NICKNAME_MAX = 30
const CODE_LENGTH = 6
const HISTORY_DAYS = 14
// 헷갈리는 글자(O, I, 0, 1)는 초대 번호에 쓰지 않는다.
const CODE_CHARS = /[^A-HJ-NP-Z2-9]/g

/** 입력한 초대 번호를 정리한다: 대문자로 바꾸고 쓸 수 없는 글자는 뺀다. */
export const normalizeCode = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(CODE_CHARS, '')
    .slice(0, CODE_LENGTH)

export const isValidCode = (value) => normalizeCode(value).length === CODE_LENGTH

/** 서버가 돌려준 오류를 앱 문구 키로 바꾼다. */
export function coupleErrorKey(error) {
  const message = String(error?.message ?? '')
  if (message.includes('invalid code')) return 'coupleErrCode'
  if (message.includes('too many attempts')) return 'coupleErrTooMany'
  if (message.includes('couple full')) return 'coupleErrFull'
  if (message.includes('already paired')) return 'coupleErrPaired'
  return null
}

/** 오늘 보낼 말 제안: 연인·친구 대화 꾸러미에서 날마다 하나. 꾸러미가 없으면 null. */
export function suggestionFor(data, now = new Date()) {
  const groups = new Set(TALK_PACKS)
  const items = (data?.items ?? []).filter((item) => groups.has(item.group))
  return items.length ? todayItem(items, now) : null
}

/** 보낸 문장을 날짜별로 묶는다(최근 날짜부터). 오늘은 아무도 안 보냈어도 항상 맨 위에 둔다. */
export function groupByDay(sentences, myId, now = new Date()) {
  const days = new Map([[dayKey(now), { day: dayKey(now), mine: null, partner: null }]])
  for (const row of sentences) {
    const entry = days.get(row.day) ?? { day: row.day, mine: null, partner: null }
    entry[row.user_id === myId ? 'mine' : 'partner'] = row
    days.set(row.day, entry)
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
}

/** 서로 보낸 날이 이어진 횟수(오늘 아직이면 어제부터 센다). */
export function exchangeStreak(groups, now = new Date()) {
  const done = new Set(groups.filter((group) => group.mine && group.partner).map((group) => group.day))
  const cursor = new Date(now)
  if (!done.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (done.has(dayKey(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}

// 반응 종류. 화면에는 글자로만 보인다(이모지 없음). 서버 표의 kind 값과 같아야 한다.
export const REACTIONS = ['heart', 'thanks', 'funny', 'learned']

/** 문장 번호별로 { mine, theirs }(각각 반응 종류 또는 null)를 만든다. */
export function reactionsBySentence(reactions, myId) {
  const bySentence = new Map()
  for (const row of reactions) {
    const entry = bySentence.get(row.sentence_id) ?? { mine: null, theirs: null }
    entry[row.user_id === myId ? 'mine' : 'theirs'] = row.kind
    bySentence.set(row.sentence_id, entry)
  }
  return bySentence
}

/** 내 짝, 짝 이름들, 최근 문장을 불러온다. 짝이 없으면 couple은 null. */
export async function loadCouple(userId) {
  if (!supabase || !userId) return { couple: null, members: [], sentences: [], reactions: [] }
  try {
    const { data: members, error } = await supabase.from('couple_members').select('couple_id, user_id, nickname')
    if (error) return failure(error)
    const mine = (members ?? []).find((member) => member.user_id === userId)
    if (!mine) return { couple: null, members: [], sentences: [], reactions: [] }
    const since = new Date()
    since.setDate(since.getDate() - HISTORY_DAYS)
    const [coupleResult, sentenceResult] = await Promise.all([
      supabase.from('couples').select('id, code').eq('id', mine.couple_id).maybeSingle(),
      supabase
        .from('couple_sentences')
        .select('id, user_id, day, body, lang, created_at')
        .eq('couple_id', mine.couple_id)
        .gte('day', dayKey(since))
        .order('day', { ascending: false }),
    ])
    if (coupleResult.error) return failure(coupleResult.error)
    if (sentenceResult.error) return failure(sentenceResult.error)
    const sentences = sentenceResult.data ?? []
    const ids = sentences.map((sentence) => sentence.id)
    let reactions = []
    if (ids.length) {
      const { data, error: reactionError } = await supabase
        .from('couple_reactions')
        .select('sentence_id, user_id, kind')
        .in('sentence_id', ids)
      if (reactionError) return failure(reactionError)
      reactions = data ?? []
    }
    return { couple: coupleResult.data, members: members ?? [], sentences, reactions }
  } catch (error) {
    return failure(error)
  }
}

async function rpc(name, args) {
  if (!supabase) return failure(new Error('no server'))
  try {
    const { data, error } = await supabase.rpc(name, args)
    return error ? failure(error) : { data }
  } catch (error) {
    return failure(error)
  }
}

export const createCouple = (nickname) => rpc('create_couple', { nick: nickname.trim().slice(0, NICKNAME_MAX) })
export async function joinCouple(code, nickname) {
  const result = await rpc('join_couple', { invite: normalizeCode(code), nick: nickname.trim().slice(0, NICKNAME_MAX) })
  // 서버는 틀린 번호를 기록하려고 오류 대신 결과 글자를 돌려준다. 앱에서는 오류로 바꿔 다룬다.
  return result.data && result.data !== 'ok' ? failure(new Error(result.data)) : result
}
export const leaveCouple = () => rpc('leave_couple')

/** 상대 문장에 반응을 남긴다. kind가 null이면 내 반응을 지운다. 같은 문장에는 하나만 남는다. */
export async function setReaction({ sentenceId, userId, kind }) {
  if (!supabase) return failure(new Error('no server'))
  if (kind !== null && !REACTIONS.includes(kind)) return failure(new Error('invalid reaction'))
  try {
    const { error } =
      kind === null
        ? await supabase.from('couple_reactions').delete().eq('sentence_id', sentenceId).eq('user_id', userId)
        : await supabase
            .from('couple_reactions')
            .upsert({ sentence_id: sentenceId, kind }, { onConflict: 'sentence_id,user_id' })
    return error ? failure(error) : {}
  } catch (error) {
    return failure(error)
  }
}

/** 오늘 문장을 보낸다. 오늘 이미 보냈다면 고쳐 쓴다. */
export async function sendSentence({ coupleId, body, lang, day = dayKey(new Date()) }) {
  const text = body.trim()
  if (!supabase) return failure(new Error('no server'))
  if (!text || text.length > SENTENCE_MAX) return failure(new Error('invalid sentence'))
  try {
    const { error } = await supabase
      .from('couple_sentences')
      .upsert({ couple_id: coupleId, day, body: text, lang }, { onConflict: 'couple_id,user_id,day' })
    return error ? failure(error) : {}
  } catch (error) {
    return failure(error)
  }
}

/** 연인 새 문장 알림을 켜고 끈다. 서버가 보낼 알림 문구의 언어(lang)도 함께 저장한다. */
export const setCoupleNotify = (enabled, lang) =>
  rpc('set_couple_notify', { enabled, msg_lang: lang === 'ko' ? 'ko' : 'en' })

/** 연인이 가장 최근에 보낸 문장(없으면 null). 내 짝이 아니면 서버가 아무것도 주지 않는다. */
export async function latestPartnerSentence(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('couple_sentences')
      .select('id, user_id, day, created_at')
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    return error ? null : (data?.[0] ?? null)
  } catch {
    return null
  }
}
