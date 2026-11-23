import { JOURNAL_DRAFTS_KEY } from './journalDrafts'
import { JOURNAL_DRAFT_KEY } from './records'

// 안드로이드 앱이 일기 파일 백업에 함께 담는 세 가지: 쓰던 새 일기, 고치던 일기, "임시저장" 목록.
// (파일 읽고 쓰기는 draftBackup.js가 하고, 여기서는 저장소 값과 파일 내용을 서로 바꾸는 일만 한다.)
export const SNAPSHOT_KEYS = {
  draft: JOURNAL_DRAFT_KEY,
  edit: `${JOURNAL_DRAFT_KEY}Edit`,
  drafts: JOURNAL_DRAFTS_KEY,
}

/** read(key)로 저장소 값을 읽어 파일에 쓸 글자로 만든다. 담을 게 하나도 없으면 null. */
export function packSnapshot(read) {
  const snapshot = {}
  for (const [name, key] of Object.entries(SNAPSHOT_KEYS)) {
    const value = read(key)
    if (typeof value === 'string' && value) snapshot[name] = value
  }
  return Object.keys(snapshot).length > 0 ? JSON.stringify(snapshot) : null
}

/** 파일 글자를 {draft, edit, drafts}로 읽는다. 망가졌거나 형식이 다르면 null. */
export function unpackSnapshot(text) {
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const snapshot = {}
    for (const name of Object.keys(SNAPSHOT_KEYS)) {
      if (typeof parsed[name] === 'string' && parsed[name]) snapshot[name] = parsed[name]
    }
    return snapshot
  } catch {
    return null
  }
}

/**
 * 파일 내용을 저장소에 되살린다. 파일은 앱이 마지막으로 뒤로 갈 때 쓴 것이라 저장소보다 새것이다.
 * 그래서 파일에 없는 것은 그 시점에 없던 것이니 저장소에서도 지운다.
 */
export function applySnapshot(snapshot, storage) {
  for (const [name, key] of Object.entries(SNAPSHOT_KEYS)) {
    if (snapshot[name]) storage.set(key, snapshot[name])
    else storage.remove(key)
  }
}
