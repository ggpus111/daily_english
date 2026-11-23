// 상대(연인·친구)와 오늘의 한 문장 주고받기(supabase/schema.sql의 couples, couple_members, couple_sentences).
// 짝 하나는 두 사람이고 종류가 연인(partner)이나 친구(friend)다. 연인은 한 명, 친구는 MAX_FRIENDS명까지.
import { dayKey } from './activity'
import { TALK_PACKS, todayItem } from './packs'
import { supabase } from './supabase'
import { failure } from './errors'

export const SENTENCE_MAX = 300
export const NICKNAME_MAX = 30
const CODE_LENGTH = 6
const HISTORY_DAYS = 14
export const PAIR_KINDS = ['partner', 'friend']
export const MAX_FRIENDS = 10
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
  if (message.includes('too many friends')) return 'pairErrTooManyFriends'
  if (message.includes('own code')) return 'pairErrOwnCode'
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

/**
 * 서버에서 읽은 줄들을 상대별 짝으로 묶는다. 연인 짝을 먼저, 친구 짝은 먼저 맺은 순서로 둔다.
 * partner는 상대(아직 안 들어왔으면 null). sentences와 reactions는 그 짝의 것만.
 */
export function buildPairs({ members = [], couples = [], sentences = [], reactions = [] }, myId) {
  const mine = members.filter((member) => member.user_id === myId)
  const order = (pair) => (pair.kind === 'partner' ? 0 : 1)
  return mine
    .map((me) => {
      const couple = couples.find((item) => item.id === me.couple_id)
      if (!couple) return null
      const pairSentences = sentences.filter((row) => row.couple_id === couple.id)
      const ids = new Set(pairSentences.map((row) => row.id))
      return {
        id: couple.id,
        code: couple.code,
        kind: couple.kind ?? 'partner',
        joinedAt: me.joined_at ?? '',
        partner: members.find((member) => member.couple_id === couple.id && member.user_id !== myId) ?? null,
        sentences: pairSentences,
        reactions: reactions.filter((row) => ids.has(row.sentence_id)),
      }
    })
    .filter(Boolean)
    .sort((a, b) => order(a) - order(b) || a.joinedAt.localeCompare(b.joinedAt))
}

/** 짝 하나의 오늘 상태: 내가 보냈는지, 상대가 보냈는지. 목록에 짧게 보여 줄 때 쓴다. */
export function todayStatus(pair, myId, now = new Date()) {
  const today = dayKey(now)
  const rows = pair.sentences.filter((row) => row.day === today)
  return {
    sent: rows.some((row) => row.user_id === myId),
    received: rows.some((row) => row.user_id !== myId),
  }
}

/** 연인 짝이 이미 있는지, 친구를 더 맺을 수 있는지(초대 화면에서 고를 수 있는 종류). */
export function canAddKind(pairs, kind) {
  const count = pairs.filter((pair) => pair.kind === kind).length
  return kind === 'partner' ? count === 0 : count < MAX_FRIENDS
}

/** 내가 들어 있는 모든 짝과 이름, 최근 문장, 반응을 불러온다. */
export async function loadPairs(userId) {
  if (!supabase || !userId) return { pairs: [] }
  try {
    const { data: members, error } = await supabase
      .from('couple_members')
      .select('couple_id, user_id, nickname, joined_at')
    if (error) return failure(error)
    const ids = [
      ...new Set((members ?? []).filter((member) => member.user_id === userId).map((member) => member.couple_id)),
    ]
    if (ids.length === 0) return { pairs: [] }
    const since = new Date()
    since.setDate(since.getDate() - HISTORY_DAYS)
    const [coupleResult, sentenceResult] = await Promise.all([
      supabase.from('couples').select('id, code, kind').in('id', ids),
      supabase
        .from('couple_sentences')
        .select('id, couple_id, user_id, day, body, lang, created_at')
        .in('couple_id', ids)
        .gte('day', dayKey(since))
        .order('day', { ascending: false }),
    ])
    if (coupleResult.error) return failure(coupleResult.error)
    if (sentenceResult.error) return failure(sentenceResult.error)
    const sentences = sentenceResult.data ?? []
    let reactions = []
    if (sentences.length) {
      const { data, error: reactionError } = await supabase
        .from('couple_reactions')
        .select('sentence_id, user_id, kind')
        .in(
          'sentence_id',
          sentences.map((row) => row.id),
        )
      if (reactionError) return failure(reactionError)
      reactions = data ?? []
    }
    return {
      pairs: buildPairs({ members: members ?? [], couples: coupleResult.data ?? [], sentences, reactions }, userId),
    }
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

export const createCouple = (nickname, kind = 'partner') =>
  rpc('create_couple', {
    nick: nickname.trim().slice(0, NICKNAME_MAX),
    pair_kind: PAIR_KINDS.includes(kind) ? kind : 'partner',
  })
export async function joinCouple(code, nickname) {
  const result = await rpc('join_couple', { invite: normalizeCode(code), nick: nickname.trim().slice(0, NICKNAME_MAX) })
  // 서버는 틀린 번호를 기록하려고 오류 대신 결과 글자를 돌려준다. 앱에서는 오류로 바꿔 다룬다.
  return result.data && result.data !== 'ok' ? failure(new Error(result.data)) : result
}
export const leaveCouple = (coupleId) => rpc('leave_couple', { target: coupleId })

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

/** 상대 새 문장 알림을 켜고 끈다(모든 상대에게 같게). 서버가 보낼 알림 문구의 언어(lang)도 함께 저장한다. */
export const setCoupleNotify = (enabled, lang) =>
  rpc('set_couple_notify', { enabled, msg_lang: lang === 'ko' ? 'ko' : 'en' })

/** 상대 중 누군가가 가장 최근에 보낸 문장(없으면 null). 내 짝이 아니면 서버가 아무것도 주지 않는다. */
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

const WATCHED_TABLES = ['couple_sentences', 'couple_reactions', 'couple_members']
const WATCH_DEBOUNCE_MS = 400

/**
 * 내 짝들의 문장·반응·짝 변화가 생기면 onChange를 부른다(Supabase Realtime, 행 단위 보안을 따라 내 짝 것만 온다).
 * 한꺼번에 여러 줄이 바뀌어도 한 번만 부르도록 잠깐 모았다가 부른다. 돌려준 함수를 부르면 구독을 끊는다.
 * onStatus(status)는 실시간 연결 상태가 바뀔 때 불린다('SUBSCRIBED'면 연결된 것). 연결이 안 될 때 더 자주 새로 불러오는 데 쓴다.
 */
export function watchPairs(onChange, onStatus) {
  if (!supabase?.channel) return () => {}
  let timer = null
  const fire = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, WATCH_DEBOUNCE_MS)
  }
  const channel = supabase.channel(`pairs-${crypto.randomUUID()}`)
  for (const table of WATCHED_TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire)
  channel.subscribe((status) => onStatus?.(status))
  return () => {
    clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}
