import { useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { openExternal } from '../lib/native'
import { frequencyLevel, isSaved, tatoebaUrl, toEntry } from '../lib/packs'
import { isNative } from '../lib/platform'
import { canSpeak, speak } from '../lib/speech'

const KINDS = {
  expression: { saveLabel: 'packSaveLabel', saved: 'packSaved' },
  word: { saveLabel: 'wordSaveLabel', saved: 'wordSaved' },
}

// 꾸러미 항목 한 개(표현 또는 단어): 영어, 뜻, 예문, 팁, 얼마나 자주 쓰이는지, 듣기와 담기.
export default function ExpressionCard({ item, kind = 'expression', headingLevel = 3 }) {
  const { t, notify, records, add } = useApp()
  const [saving, setSaving] = useState(false)
  const labels = KINDS[kind]
  const saved = isSaved(item, records[kind])
  const Heading = `h${headingLevel}`

  async function save() {
    setSaving(true)
    const { error, queued } = await add(kind, toEntry(item))
    setSaving(false)
    if (error) notify(t('saveError', { message: errorMessage(error, t) }))
    else notify(t(queued ? 'packSavedOffline' : labels.saved, { text: item.text }))
  }

  return (
    <article className="expression-card">
      <div className="expression-head">
        <Heading className="expression-text" lang="en">
          {item.text}
        </Heading>
        {item.perMillion !== undefined && (
          <span className={`frequency ${frequencyLevel(item.perMillion)}`}>
            {t(`frequency.${frequencyLevel(item.perMillion)}`)}
          </span>
        )}
      </div>
      <p className="expression-meaning">{item.meaning}</p>
      <p className="expression-example">
        <span lang="en">{item.example}</span>
        <span className="muted">{item.exampleKo}</span>
        {item.tatoeba && (
          <a
            className="example-source"
            href={tatoebaUrl(item.tatoeba)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('exampleSourceLabel', { id: item.tatoeba })}
            onClick={(event) => {
              if (!isNative) return
              event.preventDefault()
              openExternal(tatoebaUrl(item.tatoeba))
            }}
          >
            Tatoeba #{item.tatoeba}
          </a>
        )}
      </p>
      {item.tip && <p className="expression-tip">{item.tip}</p>}
      <div className="expression-actions">
        {canSpeak() && (
          <button
            type="button"
            className="text-button"
            aria-label={t('listenTo', { text: item.text })}
            onClick={() => speak(item.example === item.text ? item.text : `${item.text}. ${item.example}`)}
          >
            {t('listen')}
          </button>
        )}
        <button
          type="button"
          className={saved ? 'soft-button saved' : 'soft-button'}
          disabled={saved || saving}
          aria-label={saved ? t('packAlreadySaved', { text: item.text }) : t(labels.saveLabel, { text: item.text })}
          onClick={save}
        >
          {t(saved ? 'packAlready' : 'packSave')}
        </button>
        <span className="tiny-note">{t('packUsage', { count: item.sentences.toLocaleString() })}</span>
      </div>
    </article>
  )
}
