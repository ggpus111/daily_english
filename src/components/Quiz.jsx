import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../context'
import { dueItems } from '../lib/review'
import { isCorrectAnswer, shuffle } from '../lib/text'

const MODES = ['review', 'toMeaning', 'toText']

function buildDeck(items, mode) {
  return shuffle(mode === 'review' ? dueItems(items) : items)
}

export default function Quiz({ items, onClose, onAnswer }) {
  const { t } = useApp()
  const inputId = useId()
  const [mode, setMode] = useState('review')
  const [deck, setDeck] = useState(() => buildDeck(items, 'review'))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef(null)
  const doneRef = useRef(null)

  const card = deck[index]
  const asksMeaning = mode !== 'toText'
  const question = asksMeaning ? card?.text : card?.meaning
  const answer = asksMeaning ? card?.meaning : card?.text
  const isLast = index === deck.length - 1
  const empty = deck.length === 0

  useEffect(() => {
    if (finished || empty) doneRef.current?.focus()
    else inputRef.current?.focus()
  }, [finished, empty, index, mode])

  function restart(nextMode = mode) {
    if (items.length === 0) {
      onClose()
      return
    }
    setMode(nextMode)
    setDeck(buildDeck(items, nextMode))
    setIndex(0)
    setInput('')
    setResult(null)
    setScore(0)
    setFinished(false)
  }

  function submit(event) {
    event.preventDefault()
    if (result === null) {
      if (!input.trim()) return
      const correct = isCorrectAnswer(input, answer)
      setResult(correct)
      if (correct) setScore((value) => value + 1)
      onAnswer?.(card, correct)
    } else if (isLast) {
      setFinished(true)
    } else {
      setIndex((value) => value + 1)
      setInput('')
      setResult(null)
    }
  }

  let nextLabel = t('quizCheck')
  if (result !== null) nextLabel = t(isLast ? 'quizResult' : 'quizNext')

  let body
  if (empty) {
    body = (
      <h2 className="quiz-question" ref={doneRef} tabIndex={-1}>
        {t('reviewNothingDue')}
      </h2>
    )
  } else if (finished) {
    body = (
      <>
        <h2 className="quiz-question" ref={doneRef} tabIndex={-1}>
          {t('quizDone', { score, total: deck.length })}
        </h2>
        <button className="soft-button" onClick={() => restart()}>
          {t('quizRetry')}
        </button>
      </>
    )
  } else {
    body = (
      <form className="stack-form" onSubmit={submit}>
        <p className="quiz-progress">
          {t('quizScore', { current: index + 1, total: deck.length, score })}
        </p>
        <h2 className="quiz-question">{question}</h2>
        <div className="field">
          <label className="sr-only" htmlFor={inputId}>
            {t('quizPlaceholder')}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={input}
            readOnly={result !== null}
            autoComplete="off"
            placeholder={t('quizPlaceholder')}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        <div role="status">
          {result === true && <p className="correct-text">{t('quizCorrect')}</p>}
          {result === false && <p className="wrong-text">{t('quizWrong', { answer })}</p>}
        </div>
        <button className="primary-button">{nextLabel}</button>
      </form>
    )
  }

  return (
    <section className="quiz-panel" aria-label={t('quiz')}>
      <div className="quiz-top">
        <div className="auth-tabs compact three">
          {MODES.map((name) => (
            <button key={name} aria-pressed={mode === name} onClick={() => restart(name)}>
              {t(`quizMode.${name}`)}
            </button>
          ))}
        </div>
        <button className="text-button" onClick={onClose}>
          {t('quizClose')}
        </button>
      </div>
      {body}
    </section>
  )
}
