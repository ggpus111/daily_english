import { useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { MOODS, moodOf, moodToWord } from '../lib/moods'
import { isSaved } from '../lib/packs'

// 오늘의 기분을 영어 낱말로 고른다. 고르면 그 낱말을 쓴 예문을 보여 주고, 단어장에 담을 수 있다.
export default function MoodPicker({ value, onChange }) {
  const { t, nativeLang } = useApp()
  const mood = moodOf(value)
  const showKorean = nativeLang === 'ko'

  return (
    <fieldset className="mood-field">
      <legend>{t('moodLegend')}</legend>
      <div className="mood-chips">
        {MOODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="mood-chip"
            aria-pressed={item.id === value}
            onClick={() => onChange(item.id === value ? '' : item.id)}
          >
            <span lang="en">{item.id}</span>
            {showKorean && <small>{item.ko}</small>}
          </button>
        ))}
      </div>
      {mood && (
        <div className="mood-hint" role="status">
          <p>
            <span className="mood-hint-label">{t('moodTry')}</span> <span lang="en">{mood.sentence}</span>
          </p>
          {showKorean && <p className="muted">{mood.sentenceKo}</p>}
          <SaveMoodWord mood={mood} />
        </div>
      )}
    </fieldset>
  )
}

function SaveMoodWord({ mood }) {
  const { t, notify, records, add } = useApp()
  const [saving, setSaving] = useState(false)
  const entry = moodToWord(mood)
  const saved = isSaved(entry, records.word)

  async function save() {
    setSaving(true)
    const { error, queued } = await add('word', entry)
    setSaving(false)
    if (error) notify(t('saveError', { message: errorMessage(error, t) }))
    else notify(t(queued ? 'packSavedOffline' : 'wordSaved', { text: entry.text }))
  }

  return (
    <button
      type="button"
      className="text-button"
      disabled={saved || saving}
      aria-label={saved ? t('packAlreadySaved', { text: entry.text }) : t('wordSaveLabel', { text: entry.text })}
      onClick={save}
    >
      {t(saved ? 'packAlready' : 'moodSaveWord')}
    </button>
  )
}
