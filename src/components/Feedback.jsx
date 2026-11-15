import { parseFeedback } from '../lib/correction'

// 붙여 넣은 AI 교정을 제목별로 보여 준다. 정해진 형식이 아니면 받은 글을 그대로 보여 준다.
export default function Feedback({ text, learningLang, t }) {
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
                </li>
              ),
            )}
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
