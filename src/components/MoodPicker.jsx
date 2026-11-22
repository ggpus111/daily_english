import { useState } from 'react'
import { useApp } from '../context'
import { MOODS, MOODS_SHOWN, moodExample, moodMeaning, moodOf, moodToWord, moodWord } from '../lib/moods'
import SaveEntryButton from './SaveEntryButton'

// 오늘의 기분을 배우는 언어의 낱말로 고른다. 고르면 그 낱말을 쓴 예문을 보여 주고, 단어장에 담을 수 있다.
// 자주 고르는 12개를 먼저 보여 주고, 나머지는 "기분 더 보기"로 연다(고른 기분이 뒤쪽이면 처음부터 연다).
export default function MoodPicker({ value, onChange }) {
  const { t, learningLang } = useApp()
  const mood = moodOf(value)
  const selectedIndex = MOODS.findIndex((item) => item.id === value)
  const [expanded, setExpanded] = useState(selectedIndex >= MOODS_SHOWN)
  const visible = expanded ? MOODS : MOODS.slice(0, MOODS_SHOWN)
  const example = mood ? moodExample(mood, learningLang) : null

  return (
    <fieldset className="mood-field">
      <legend>{t('moodLegend')}</legend>
      <div className="mood-chips">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            className="mood-chip"
            aria-pressed={item.id === value}
            onClick={() => onChange(item.id === value ? '' : item.id)}
          >
            <span lang={learningLang}>{moodWord(item, learningLang)}</span>
            <small>{moodMeaning(item, learningLang)}</small>
          </button>
        ))}
      </div>
      <button type="button" className="text-button mood-more" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
        {t(expanded ? 'moodLess' : 'moodMore', { count: MOODS.length - MOODS_SHOWN })}
      </button>
      {mood && (
        <div className="mood-hint" role="status">
          <p>
            <span className="mood-hint-label">{t('moodTry')}</span> <span lang={learningLang}>{example.sentence}</span>
          </p>
          <p className="muted">{example.translation}</p>
          <SaveEntryButton kind="word" entry={moodToWord(mood, learningLang)} label="moodSaveWord" className="text-button" />
        </div>
      )}
    </fieldset>
  )
}
