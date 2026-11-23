import { useApp } from '../context'
import { fixToExpression, parseFeedback } from '../lib/correction'
import SaveEntryButton from './SaveEntryButton'

// 붙여 넣은 AI 교정을 제목별로 보여 준다. 정해진 형식이 아니면 받은 글을 그대로 보여 준다.
// canSave를 주면 "고칠 점"마다 표현 모음에 담는 버튼을 붙인다(틀렸던 말을 복습으로 이어 주기).
export default function Feedback({ text, learningLang, t, canSave = false }) {
  const parsed = parseFeedback(text)
  if (!parsed) return <p className="feedback-raw">{text}</p>

  return (
    <div className="feedback">
      {parsed.corrected && (
        <section>
          <h3>{t('feedbackCorrected')}</h3>
          <p className="feedback-corrected" lang={learningLang}>
            {parsed.corrected}
          </p>
        </section>
      )}
      {parsed.fixes.length > 0 && (
        <section>
          <h3>{t('feedbackFixes')}</h3>
          <ul className="feedback-fixes">
            {parsed.fixes.map((fix, index) =>
              fix.text ? (
                <li key={index}>{fix.text}</li>
              ) : (
                <li key={index}>
                  <span className="fix-pair">
                    <del lang={learningLang}>{fix.original}</del>
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only">{t('feedbackFixedTo')}</span>
                    <ins lang={learningLang}>{fix.fixed}</ins>
                  </span>
                  {fix.reason && <span className="fix-reason">{fix.reason}</span>}
                  {canSave && <SaveFixButton fix={fix} corrected={parsed.corrected} />}
                </li>
              ),
            )}
          </ul>
          {canSave && <p className="tiny-note">{t('fixSaveHelp')}</p>}
        </section>
      )}
      {parsed.natural.length > 0 && (
        <section>
          <h3>{t('feedbackNatural')}</h3>
          <ul className="feedback-fixes">
            {parsed.natural.map((item, index) => (
              <li key={index}>
                <span lang={learningLang}>{item.text}</span>
                {item.note && <span className="fix-reason">{item.note}</span>}
                {canSave && (
                  <SaveEntryButton
                    kind="expression"
                    entry={{ text: item.text, meaning: item.note, example: '' }}
                    label="fixSave"
                    className="text-button fix-save"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {parsed.grammar.length > 0 && (
        <section>
          <h3>{t('feedbackGrammar')}</h3>
          <ul className="feedback-fixes">
            {parsed.grammar.map((item, index) => (
              <li key={index}>
                <strong lang={learningLang}>{item.text}</strong>
                <span className="fix-reason">{item.meaning}</span>
                {item.example && (
                  <span className="fix-reason" lang={learningLang}>
                    {item.example}
                    {item.exampleNative && ` (${item.exampleNative})`}
                  </span>
                )}
                {canSave && (
                  <SaveEntryButton
                    kind="grammar"
                    entry={{ ...item, source: 'journal' }}
                    label="grammarSave"
                    className="text-button fix-save"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {parsed.good && (
        <section>
          <h3>{t('feedbackGood')}</h3>
          <p>{parsed.good}</p>
        </section>
      )}
      {parsed.practice && (
        <section>
          <h3>{t('feedbackPractice')}</h3>
          <p>{parsed.practice}</p>
        </section>
      )}
    </div>
  )
}

function SaveFixButton({ fix, corrected }) {
  const { t } = useApp()
  return (
    <SaveEntryButton
      kind="expression"
      entry={fixToExpression(fix, corrected, t('fixOriginalLabel'))}
      label="fixSave"
      className="text-button fix-save"
    />
  )
}
