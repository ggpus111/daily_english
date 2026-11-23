import { useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { isSaved } from '../lib/packs'

const MESSAGES = {
  word: { label: 'wordSaveLabel', saved: 'wordSaved' },
  expression: { label: 'packSaveLabel', saved: 'packSaved' },
  grammar: { label: 'grammarSaveLabel', saved: 'grammarSaved' },
}

// "단어장·표현 모음에 담기" 버튼 하나. 꾸러미 카드, 일기 교정, 오늘의 기분이 함께 쓴다.
// 이미 담은 말이면 "담았어요"로 바뀌고 눌리지 않는다.
export default function SaveEntryButton({ kind, entry, label, className = 'soft-button' }) {
  const { t, notify, records, add } = useApp()
  const [saving, setSaving] = useState(false)
  const saved = isSaved(entry, records[kind])
  const messages = MESSAGES[kind]

  async function save() {
    setSaving(true)
    const { error, queued } = await add(kind, entry)
    setSaving(false)
    if (error) notify(t('saveError', { message: errorMessage(error, t) }))
    else notify(t(queued ? 'packSavedOffline' : messages.saved, { text: entry.text }))
  }

  return (
    <button
      type="button"
      className={saved ? `${className} saved` : className}
      disabled={saved || saving}
      aria-label={saved ? t('packAlreadySaved', { text: entry.text }) : t(messages.label, { text: entry.text })}
      onClick={save}
    >
      {t(saved ? 'packAlready' : label)}
    </button>
  )
}
