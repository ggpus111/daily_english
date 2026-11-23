// 안드로이드 앱에서 쓰던 일기를 휴대폰 파일에도 남긴다.
// 쓰던 일기는 입력할 때마다 웹뷰 저장소(localStorage)에 넣지만, 웹뷰는 몇 초씩 모았다가 디스크에 쓴다.
// 다른 앱에 간 사이 안드로이드가 메모리 부족으로 앱을 끄면 그 몇 초 치가 사라질 수 있어서,
// 앱이 뒤로 갈 때(pause) 바로 파일로 쓰고, 다시 켤 때 파일에서 되살린다.
// 파일에는 쓰던 새 일기, 고치던 일기, "임시저장한 일기" 목록을 함께 담는다(draftSnapshot.js).
import { App } from '@capacitor/app'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { applySnapshot, packSnapshot, unpackSnapshot } from './draftSnapshot'
import { isNative } from './platform'
import { JOURNAL_DRAFT_KEY } from './records'
import { local } from './storage'

const FILE = 'journal-drafts.json'
// 예전 버전이 쓰던 파일(쓰던 새 일기 하나만 들어 있다). 새 파일이 없을 때만 읽는다.
const OLD_FILE = 'journal-draft.json'
const RESTORE_TIMEOUT_MS = 800
const where = (path) => ({ path, directory: Directory.Data })

const readFile = (path) =>
  Promise.race([
    Filesystem.readFile({ ...where(path), encoding: Encoding.UTF8 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), RESTORE_TIMEOUT_MS)),
  ])

/**
 * 첫 화면을 그리기 전에 부른다(웹은 아무것도 하지 않는다).
 * 파일은 앱이 마지막으로 뒤로 갈 때 쓴 것이라, 디스크에 늦게 써지는 웹뷰 저장소보다 새것이다.
 * 저장소에는 빈 일기 폼도 늘 들어 있어서 "없을 때만"이 아니라 파일이 있으면 파일로 맞춘다.
 */
export async function restoreDraft() {
  if (!isNative) return
  try {
    const { data } = await readFile(FILE)
    const snapshot = typeof data === 'string' ? unpackSnapshot(data) : null
    if (snapshot) {
      applySnapshot(snapshot, local)
      return
    }
  } catch {
    // 새 파일이 없으면 예전 파일을 본다.
  }
  try {
    const { data } = await readFile(OLD_FILE)
    if (typeof data === 'string' && data) local.set(JOURNAL_DRAFT_KEY, data)
  } catch {
    // 파일이 없거나 늦으면 그냥 빈 일기로 시작한다.
  }
}

/** 로그아웃할 때: 다음 사람이 쓰던 일기를 보지 않게 파일도 지운다. */
export function clearDraftBackup() {
  if (!isNative) return
  for (const path of [FILE, OLD_FILE]) Filesystem.deleteFile(where(path)).catch(() => {})
}

/** 앱이 뒤로 갈 때마다 쓰던 일기들을 파일로 옮긴다. 남길 게 하나도 없으면 파일도 지운다. */
export function backupDraftOnPause() {
  if (!isNative) return
  App.addListener('pause', () => {
    const text = packSnapshot((key) => local.get(key))
    const done = text
      ? Filesystem.writeFile({ ...where(FILE), data: text, encoding: Encoding.UTF8 })
      : Filesystem.deleteFile(where(FILE))
    done.catch(() => {})
  })
}
