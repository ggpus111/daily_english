import { useApp } from '../context'
import { MOODS, moodOf, moodToWord } from '../lib/moods'
import SaveEntryButton from './SaveEntryButton'

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
          <SaveEntryButton kind="word" entry={moodToWord(mood)} label="moodSaveWord" className="text-button" />
        </div>
      )}
    </fieldset>
  )
}
