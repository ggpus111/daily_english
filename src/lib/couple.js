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

/** 내 짝, 짝 이름들, 최근 문장을 불러온다. 짝이 없으면 couple은 null. */
export async function loadCouple(userId) {
  if (!supabase || !userId) return { couple: null, members: [], sentences: [] }
  try {
    const { data: members, error } = await supabase.from('couple_members').select('couple_id, user_id, nickname')
    if (error) return failure(error)
    const mine = (members ?? []).find((member) => member.user_id === userId)
    if (!mine) return { couple: null, members: [], sentences: [] }
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
    return { couple: coupleResult.data, members: members ?? [], sentences: sentenceResult.data ?? [] }
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
export const joinCouple = (code, nickname) =>
  rpc('join_couple', { invite: normalizeCode(code), nick: nickname.trim().slice(0, NICKNAME_MAX) })
export const leaveCouple = () => rpc('leave_couple')

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
