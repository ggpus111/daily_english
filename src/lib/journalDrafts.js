import { local } from './storage'

// "임시저장" 버튼으로 따로 모아 두는 일기들. 쓰던 내용이 자동으로 남는 것(journalDraft)과는 별개로,
// 지금 쓰던 일기를 잠깐 치워 두고 다른 일기를 쓰다가 나중에 이어 쓸 수 있게 한다. 이 기기에만 남는다.
export const JOURNAL_DRAFTS_KEY = 'journalDrafts'
export const MAX_DRAFTS = 20

const TEXT_FIELDS = ['native', 'translation', 'memo']

/** 글이 한 글자라도 있는지(기분만 고른 것은 임시저장할 내용으로 치지 않는다). */
export const hasDraftText = (form) => TEXT_FIELDS.some((field) => String(form?.[field] ?? '').trim() !== '')

const isDraft = (item) =>
  item && typeof item.id === 'string' && typeof item.savedAt === 'string' && item.form && typeof item.form === 'object'

export function loadDrafts() {
  const list = local.getJson(JOURNAL_DRAFTS_KEY)
  return Array.isArray(list) ? list.filter(isDraft) : []
}

const store = (list) => {
  local.set(JOURNAL_DRAFTS_KEY, JSON.stringify(list))
  return list
}

/** 지금 폼을 임시저장함 맨 위에 넣는다. 글이 없으면 아무것도 하지 않고 null을 돌려준다. 가득 차면 가장 오래된 것부터 밀려난다. */
export function addDraft(form, now = new Date()) {
  if (!hasDraftText(form)) return null
  const draft = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: now.toISOString(),
    form: { ...form },
  }
  return store([draft, ...loadDrafts()].slice(0, MAX_DRAFTS))
}

export const removeDraft = (id) => store(loadDrafts().filter((item) => item.id !== id))

/** 되돌리기용: 지웠던 임시저장을 원래 시각 순서대로 다시 넣는다. */
export function putBackDraft(draft) {
  if (!isDraft(draft)) return loadDrafts()
  const list = loadDrafts().filter((item) => item.id !== draft.id)
  return store([...list, draft].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, MAX_DRAFTS))
}

export const clearDrafts = () => local.remove(JOURNAL_DRAFTS_KEY)

/** 목록에 보여 줄 한 줄 제목: 일기 본문 첫 줄(없으면 번역, 메모). */
export function draftTitle(form, max = 40) {
  const text = TEXT_FIELDS.map((field) => String(form?.[field] ?? '').trim()).find(Boolean) ?? ''
  const line = text.split('\n')[0].trim()
  return line.length > max ? `${line.slice(0, max)}…` : line
}
