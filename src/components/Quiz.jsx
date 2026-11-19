import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../context'
import { makeBlank } from '../lib/blank'
import { dueItems } from '../lib/review'
import { isCorrectAnswer, shuffle } from '../lib/text'

const MODES = ['review', 'toMeaning', 'toText', 'blank']

function buildDeck(items, mode) {
  if (mode === 'review') return shuffle(dueItems(items))
  // 빈칸 채우기는 예문에 그 단어가 들어 있는 기록만 낸다.
  if (mode === 'blank') return shuffle(items.filter((item) => makeBlank(item)))
  return shuffle(items)
}

// 뜻을 떠올리는 문제는 카드를 뒤집어 스스로 채점한다. 우리말 뜻은 표현 방법이 여러 가지라
// 똑같이 타이핑하게 하면 알아도 틀리기 때문이다("놀다"와 "어울려 놀다").
// 일기 교정에서 담은 표현은 뜻 칸에 "원래 쓴 말 · 이유"가 있어서, 복습 때는 그걸 보고 고친 말을 쓴다.
const flipsFor = (mode, card) => mode === 'toMeaning' || (mode === 'review' && card?.source !== 'journal')

export default function Quiz({ items, onClose, onAnswer }) {
  const { t } = useApp()
  const inputId = useId()
  const [mode, setMode] = useState('review')
  const [deck, setDeck] = useState(() => buildDeck(items, 'review'))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef(null)
  const revealRef = useRef(null)
  const knewRef = useRef(null)
  const doneRef = useRef(null)
  const nextRef = useRef(null)

  const card = deck[index]
  const blank = mode === 'blank' && card ? makeBlank(card) : null
  const flips = !blank && flipsFor(mode, card)
  const answer = blank ? blank.answer : card?.text
  const isLast = index === deck.length - 1
  const empty = deck.length === 0

  useEffect(() => {
    if (finished || empty) doneRef.current?.focus()
    else if (flips && revealed) knewRef.current?.focus()
    else if (flips) revealRef.current?.focus()
    else inputRef.current?.focus()
  }, [finished, empty, index, mode, flips, revealed])

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
    setRevealed(false)
    setScore(0)
    setFinished(false)
  }

  // 채점 결과는 다음 문제로 넘어갈 때 한 번만 저장한다("제 답도 맞아요"로 바꿀 수 있게).
  function advance(correct) {
    onAnswer?.(card, correct)
    if (correct) setScore((value) => value + 1)
    if (isLast) {
      setFinished(true)
    } else {
      setIndex((value) => value + 1)
      setInput('')
      setResult(null)
      setRevealed(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    if (result === null) {
      if (!input.trim()) return
      // 빈칸은 예문 속 형태(bored)도, 기본형(bore)도 정답으로 본다.
      setResult(isCorrectAnswer(input, answer) || (blank !== null && isCorrectAnswer(input, card.text)))
    } else {
      advance(result)
    }
  }

  let body
  if (empty) {
    body = (
      <h2 className="quiz-question" ref={doneRef} tabIndex={-1}>
        {t(mode === 'blank' ? 'quizBlankEmpty' : 'reviewNothingDue')}
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
  } else if (flips) {
    body = (
      <div className="stack-form">
        <p className="quiz-progress">{t('quizScore', { current: index + 1, total: deck.length, score })}</p>
        <h2 className="quiz-question" lang="en">
          {card.text}
        </h2>
        {!revealed ? (
          <>
            <p className="quiz-hint">{t('quizFlipHint')}</p>
            <button className="primary-button" ref={revealRef} onClick={() => setRevealed(true)}>
              {t('quizReveal')}
            </button>
          </>
        ) : (
          <>
            <div className="quiz-reveal" role="status">
              <p className="quiz-answer">{card.meaning}</p>
              {card.example && (
                <p className="muted" lang="en">
                  {card.example}
                </p>
              )}
            </div>
            <p className="quiz-hint">{t('quizGradeHint')}</p>
            <div className="quiz-grade">
              <button className="primary-button" ref={knewRef} onClick={() => advance(true)}>
                {t('quizKnew')}
              </button>
              <button className="soft-button" onClick={() => advance(false)}>
                {t('quizMissed')}
              </button>
            </div>
          </>
        )}
      </div>
    )
  } else {
    body = (
      <form className="stack-form" onSubmit={submit}>
        <p className="quiz-progress">{t('quizScore', { current: index + 1, total: deck.length, score })}</p>
        {blank ? (
          <>
            <h2 className="quiz-question quiz-sentence" lang="en">
              {blank.before}
              <span className="quiz-blank" aria-hidden="true">
                ____
              </span>
              <span className="sr-only">{t('quizBlankSpoken')}</span>
              {blank.after}
            </h2>
            <p className="quiz-hint">{t('quizBlankHint', { meaning: card.meaning })}</p>
          </>
        ) : (
          <h2 className="quiz-question">{card.meaning}</h2>
        )}
        <div className="field">
          <label className="sr-only" htmlFor={inputId}>
            {t('quizPlaceholder')}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            value={input}
            lang="en"
            readOnly={result !== null}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={t('quizPlaceholder')}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        <div role="status">
          {result === true && <p className="correct-text">{t('quizCorrect')}</p>}
          {result === false && <p className="wrong-text">{t('quizWrong', { answer })}</p>}
        </div>
        {result === false && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setResult(true)
              nextRef.current?.focus()
            }}
          >
            {t('quizMarkRight')}
          </button>
        )}
        <button className="primary-button" ref={nextRef}>
          {t(result === null ? 'quizCheck' : isLast ? 'quizResult' : 'quizNext')}
        </button>
      </form>
    )
  }

  return (
    <section className="quiz-panel" aria-label={t('quiz')}>
      <div className="quiz-top">
        <div className="auth-tabs compact four">
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
