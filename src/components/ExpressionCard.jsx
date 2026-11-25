import { useApp } from '../context'
import { openExternal } from '../lib/native'
import { frequencyLevel, tatoebaUrl, toEntry } from '../lib/packs'
import { isNative } from '../lib/platform'
import { canSpeak, speak } from '../lib/speech'
import ReportPackItem from './ReportPackItem'
import SaveEntryButton from './SaveEntryButton'

// 꾸러미 항목 한 개(표현 또는 단어): 영어, 뜻, 예문, 팁, 얼마나 자주 쓰이는지, 듣기와 담기.
export default function ExpressionCard({ item, kind = 'expression', headingLevel = 3 }) {
  const { t, learningLang } = useApp()
  const Heading = `h${headingLevel}`

  return (
    <article className="expression-card">
      <div className="expression-head">
        <Heading className="expression-text" lang={learningLang}>
          {item.text}
        </Heading>
        {item.perMillion !== undefined && (
          <span className={`frequency ${frequencyLevel(item.perMillion)}`}>
            {t(`frequency.${frequencyLevel(item.perMillion)}`)}
          </span>
        )}
        {item.texting && <span className="frequency common">{t('frequency.texting')}</span>}
        <ReportPackItem item={item} kind={kind} />
      </div>
      <p className="expression-meaning">{item.meaning}</p>
      <p className="expression-example">
        <span lang={learningLang}>{item.example}</span>
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
            onClick={() => speak(item.example === item.text ? item.text : `${item.text}. ${item.example}`, learningLang)}
          >
            {t('listen')}
          </button>
        )}
        <SaveEntryButton kind={kind} entry={toEntry(item)} label="packSave" />
        {item.sentences !== undefined && <span className="tiny-note">{t('packUsage', { count: item.sentences.toLocaleString() })}</span>}
      </div>
    </article>
  )
}
