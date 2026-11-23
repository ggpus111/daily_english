import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { makeBlank } from '../lib/blank'
import { buildChoices, canMakeChoices, choicePool } from '../lib/choices'
import { dueItems } from '../lib/review'
import { canSpeak, speak } from '../lib/speech'
import { isCorrectAnswer, shuffle } from '../lib/text'

// 듣기는 기기에 음성 읽기가 있을 때만 보인다.
const MODES = ['review', 'toMeaning', 'toText', 'choice', 'blank', ...(canSpeak() ? ['listen'] : [])]

function buildDeck(items, mode) {
  if (mode === 'review') return shuffle(dueItems(items))
  // 빈칸 채우기는 예문에 그 단어가 들어 있는 기록만 낸다.
  if (mode === 'blank') return shuffle(items.filter((item) => makeBlank(item)))
  // 객관식은 서로 다른 뜻이 보기 개수만큼 있어야 한다. 모자라면 빈 덱으로 두고 안내한다.
  if (mode === 'choice') {
    const pool = choicePool(items)
    return canMakeChoices(pool) ? shuffle(pool) : []
  }
  return shuffle(items)
}

// 뜻을 떠올리는 문제는 카드를 뒤집어 스스로 채점한다. 우리말 뜻은 표현 방법이 여러 가지라
// 똑같이 타이핑하게 하면 알아도 틀리기 때문이다("놀다"와 "어울려 놀다").
// 일기 교정에서 담은 표현은 뜻 칸에 "원래 쓴 말 · 이유"가 있어서, 복습 때는 그걸 보고 고친 말을 쓴다.
const flipsFor = (mode, card) => mode === 'toMeaning' || (mode === 'review' && card?.source !== 'journal')

export default function Quiz({ items, onClose, onAnswer }) {
  const { t, learningLang } = useApp()
  const inputId = useId()
  const [mode, setMode] = useState('review')
  const [deck, setDeck] = useState(() => buildDeck(items, 'review'))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef(null)
  const revealRef = useRef(null)
  const knewRef = useRef(null)
  const doneRef = useRef(null)
  const nextRef = useRef(null)

  const card = deck[index]
  const blank = mode === 'blank' && card ? makeBlank(card) : null
  const choosing = mode === 'choice'
  const listening = mode === 'listen'
  const flips = !blank && !choosing && flipsFor(mode, card)
  // 보기는 문제마다 한 번만 섞어 둔다(다시 그려도 순서가 바뀌지 않게).
  const choices = useMemo(
    () => (choosing && card ? buildChoices(card, choicePool(items)) : null),
    [choosing, card, items],
  )
  const answer = blank ? blank.answer : card?.text
  const isLast = index === deck.length - 1
  const empty = deck.length === 0
  const emptyKey = { blank: 'quizBlankEmpty', choice: 'quizChoiceEmpty' }[mode] ?? 'reviewNothingDue'

  useEffect(() => {
    if (finished || empty) doneRef.current?.focus()
    else if (choosing && picked !== null) nextRef.current?.focus()
    else if (flips && revealed) knewRef.current?.focus()
    else if (flips) revealRef.current?.focus()
    else inputRef.current?.focus()
  }, [finished, empty, index, mode, flips, revealed, choosing, picked])

  // 듣기 문제는 문제가 바뀔 때 한 번 읽어 준다.
  useEffect(() => {
    if (listening && card && !finished) speak(card.text, learningLang)
  }, [listening, card, finished, learningLang])

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
    setPicked(null)
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
      setPicked(null)
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
        {t(emptyKey)}
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
  } else if (choosing && choices) {
    body = (
      <div className="stack-form">
        <p className="quiz-progress">{t('quizScore', { current: index + 1, total: deck.length, score })}</p>
        <h2 className="quiz-question" lang={learningLang}>
          {card.text}
        </h2>
        <p className="quiz-hint">{t('quizChoiceHint')}</p>
        <div className="quiz-choices" role="group" aria-label={t('quizChoiceHint')}>
          {choices.map((choice) => {
            const state = picked === null ? '' : choice === card.meaning ? 'right' : choice === picked ? 'wrong' : ''
            return (
              <button
                key={choice}
                className={`quiz-choice ${state}`}
                disabled={picked !== null}
                onClick={() => setPicked(choice)}
              >
                {choice}
              </button>
            )
          })}
        </div>
        <div role="status">
          {picked !== null && picked === card.meaning && <p className="correct-text">{t('quizCorrect')}</p>}
          {picked !== null && picked !== card.meaning && (
            <p className="wrong-text">{t('quizWrong', { answer: card.meaning })}</p>
          )}
        </div>
        {picked !== null && (
          <button className="primary-button" ref={nextRef} onClick={() => advance(picked === card.meaning)}>
            {t(isLast ? 'quizResult' : 'quizNext')}
          </button>
        )}
      </div>
    )
  } else if (flips) {
    body = (
      <div className="stack-form">
        <p className="quiz-progress">{t('quizScore', { current: index + 1, total: deck.length, score })}</p>
        <h2 className="quiz-question" lang={learningLang}>
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
                <p className="muted" lang={learningLang}>
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
            <h2 className="quiz-question quiz-sentence" lang={learningLang}>
              {blank.before}
              <span className="quiz-blank" aria-hidden="true">
                ____
              </span>
              <span className="sr-only">{t('quizBlankSpoken')}</span>
              {blank.after}
            </h2>
            <p className="quiz-hint">{t('quizBlankHint', { meaning: card.meaning })}</p>
          </>
        ) : listening ? (
          <>
            <button type="button" className="soft-button" onClick={() => speak(card.text, learningLang)}>
              {t('quizListenPlay')}
            </button>
            <p className="quiz-hint">{t('quizListenHint')}</p>
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
            lang={learningLang}
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
        <div className="auth-tabs compact six">
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
