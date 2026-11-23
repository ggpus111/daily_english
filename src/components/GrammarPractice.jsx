import { useState } from 'react'
import { useApp } from '../context'
import { aiConfigured, giveAiConsent, hasAiConsent, requestCorrection } from '../lib/aiCorrection'
import { buildGrammarCheckPrompt, modesFor, parseGrammarCheck } from '../lib/grammar'
import { languageName } from '../lib/i18n'
import Field from './Field'

/**
 * 문법 연습. 문법마다 번역(우리말 예문을 그 문법으로 옮기기)이나 작문(그 문법으로 문장 짓기)을 하고,
 * 모범 답을 보거나 AI에게 확인받은 뒤 스스로 채점한다. 채점은 onAnswer로 넘겨 복습 일정에 남긴다.
 */
export default function GrammarPractice({ notes, onClose, onAnswer }) {
  const { t, learningLang, nativeLang, user, notify } = useApp()
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState(() => modesFor(notes[0])[0])
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [askingConsent, setAskingConsent] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const note = notes[index]
  const modes = modesFor(note)
  const canAskAi = aiConfigured() && Boolean(user)
  const learning = languageName(learningLang, nativeLang)

  function resetFor(next) {
    setMode(modesFor(next)[0])
    setAnswer('')
    setRevealed(false)
    setCheck(null)
    setAskingConsent(false)
  }

  function grade(correct) {
    onAnswer?.(note, correct)
    if (correct) setScore((value) => value + 1)
    if (index === notes.length - 1) {
      setFinished(true)
      return
    }
    resetFor(notes[index + 1])
    setIndex(index + 1)
  }

  async function askAi() {
    if (!answer.trim()) {
      notify(t('grammarNeedAnswer'))
      return
    }
    if (!hasAiConsent()) {
      setAskingConsent(true)
      return
    }
    setBusy(true)
    const result = await requestCorrection(
      buildGrammarCheckPrompt({
        uiLang: nativeLang,
        learning,
        explain: languageName(nativeLang, nativeLang),
        note,
        mode,
        source: note.exampleNative,
        answer: answer.trim(),
      }),
    )
    setBusy(false)
    if (result.error) {
      notify(t(`aiError.${result.error}`))
      return
    }
    setCheck({ text: result.feedback, parsed: parseGrammarCheck(result.feedback) })
    setRevealed(true)
  }

  if (finished) {
    return (
      <section className="quiz-panel" aria-label={t('grammarPractice')}>
        <h2 className="quiz-question">{t('quizDone', { score, total: notes.length })}</h2>
        <button className="soft-button" onClick={onClose}>
          {t('quizClose')}
        </button>
      </section>
    )
  }

  return (
    <section className="quiz-panel grammar-practice" aria-label={t('grammarPractice')}>
      <div className="quiz-top">
        <p className="quiz-progress">{t('quizScore', { current: index + 1, total: notes.length, score })}</p>
        <button className="text-button" onClick={onClose}>
          {t('quizClose')}
        </button>
      </div>
      <div className="grammar-point">
        <h2 className="quiz-question" lang={learningLang}>
          {note.text}
        </h2>
        <p className="muted">{note.meaning}</p>
      </div>
      {modes.length > 1 && (
        <div className="filter-chips" role="group" aria-label={t('grammarModeLabel')}>
          {modes.map((value) => (
            <button
              key={value}
              className="reaction-chip"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value)
                setRevealed(false)
                setCheck(null)
              }}
            >
              {t(`grammarMode.${value}`)}
            </button>
          ))}
        </div>
      )}
      <p className="quiz-hint">
        {mode === 'translate' ? t('grammarTranslateHint', { lang: learning }) : t('grammarComposeHint')}
      </p>
      {mode === 'translate' && <p className="grammar-source">{note.exampleNative}</p>}
      <Field
        as="textarea"
        label={t('grammarAnswer')}
        rows={2}
        maxLength={500}
        value={answer}
        lang={learningLang}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <div className="button-row">
        {canAskAi && (
          <button className="primary-button" disabled={busy} onClick={askAi}>
            {t(busy ? 'aiLoading' : 'grammarAskAi')}
          </button>
        )}
        {note.example && (
          <button className="soft-button" onClick={() => setRevealed(true)}>
            {t(mode === 'translate' ? 'grammarShowAnswer' : 'grammarShowExample')}
          </button>
        )}
      </div>
      {!canAskAi && <p className="tiny-note">{t('grammarAiLogin')}</p>}

      {askingConsent && (
        <div className="ai-consent" role="region" aria-label={t('aiConsentTitle')}>
          <p>{t('grammarAiConsentBody')}</p>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={() => {
                giveAiConsent()
                setAskingConsent(false)
                askAi()
              }}
            >
              {t('aiConsentYes')}
            </button>
            <button className="soft-button" onClick={() => setAskingConsent(false)}>
              {t('aiConsentNo')}
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="quiz-reveal" role="status">
          {check?.parsed ? (
            <>
              <p className={check.parsed.ok ? 'correct-text' : 'wrong-text'}>
                {t(check.parsed.ok ? 'grammarCheckOk' : 'grammarCheckFix')}
              </p>
              {check.parsed.corrected && (
                <p className="quiz-answer" lang={learningLang}>
                  {check.parsed.corrected}
                </p>
              )}
              {check.parsed.why && <p>{check.parsed.why}</p>}
            </>
          ) : check ? (
            <p className="feedback-raw">{check.text}</p>
          ) : null}
          {note.example && (
            <p className="muted" lang={learningLang}>
              {t('grammarExampleLabel')}: {note.example}
            </p>
          )}
        </div>
      )}

      {(revealed || answer.trim()) && (
        <>
          <p className="quiz-hint">{t('grammarGradeHint')}</p>
          <div className="quiz-grade">
            <button className="primary-button" onClick={() => grade(true)}>
              {t('quizKnew')}
            </button>
            <button className="soft-button" onClick={() => grade(false)}>
              {t('quizMissed')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
