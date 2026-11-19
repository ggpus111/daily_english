import { useApp } from '../context'
import { usePackData } from '../hooks/usePackData'

const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?,]/g, '')
    .trim()

// 단어장·표현 모음에 직접 넣는 말이 꾸러미에 있으면, 뜻과 예문을 한 번에 채울 수 있게 한다.
export default function PackMeaningHint({ type, form, setField }) {
  const { t, notify, learningLang } = useApp()
  const { data } = usePackData(type === 'word' ? 'words' : 'expressions')
  const key = normalize(form.text)
  if (learningLang !== 'en' || !data || !key) return null
  const item = data.items.find((entry) => normalize(entry.text) === key)
  if (!item || form.meaning.trim() === item.meaning) return null

  function fill() {
    setField('meaning', item.meaning)
    if (!form.example.trim()) setField('example', item.example)
    notify(t('packMeaningFilled'))
  }

  return (
    <p className="pack-hint">
      <span>
        {t('packMeaningHint')} <b>{item.meaning}</b>
      </span>
      <button type="button" className="text-button" onClick={fill}>
        {t('packMeaningFill')}
      </button>
    </p>
  )
}
