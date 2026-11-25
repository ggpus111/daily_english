import { useApp } from '../context'
import { usePackData } from '../hooks/usePackData'
import { findPhrase } from '../lib/blank'
import { useState } from 'react'
import { pickTodayExpression, readMissionTurn, readPurpose, saveMissionTurn } from '../lib/purpose'
import { usedEntries } from '../lib/usage'

/** 내가 모은 단어·표현 (표현 먼저) */
export function useMyEntries() {
  const { records } = useApp()
  return [...records.expression, ...records.word]
}

// 일기 번역에 쓴 내 단어·표현. live면 쓰는 동안 바뀔 때마다 보조 기술에 알린다.
export function UsageLine({ sentence, live = false }) {
  const { t, learningLang } = useApp()
  const used = usedEntries(sentence, useMyEntries())
  const text = used.length > 0 ? t('usageFound', { count: used.length }) : live && sentence?.trim() ? t('usageNone') : ''

  return (
    <p className={used.length > 0 ? 'usage-line found' : 'usage-line'} aria-live={live ? 'polite' : undefined}>
      {text}
      {used.length > 0 && ' '}
      {used.map((entry, index) => (
        <span key={entry.id ?? entry.text}>
          {index > 0 && ', '}
          <b lang={learningLang}>{entry.text}</b>
        </span>
      ))}
    </p>
  )
}

// 오늘의 표현을 일기에 써 보는 작은 미션. 번역에 쓰면 바로 도장이 찍힌다.
// 공부 목적(일상·비즈니스·학업)에 맞는 표현 중에서, 기분을 고르면 그 기분에 어울리는 표현으로 바꿔 준다.
// "다른 표현"을 누르면 바꿔 보여 주고, 고른 표현은 홈의 오늘의 표현에도 그대로 보인다.
export function TodayMission({ sentence, mood = '' }) {
  const { t, learningLang } = useApp()
  const { data } = usePackData('expressions')
  const [turns, setTurns] = useState({})
  if (!data) return null
  const turn = turns[mood] ?? readMissionTurn(mood)
  const item = pickTodayExpression(data.items, { purpose: readPurpose(), mood, turn })
  const done = Boolean(findPhrase(item.text, sentence))
  const next = () => {
    setTurns((value) => ({ ...value, [mood]: turn + 1 }))
    saveMissionTurn(mood, turn + 1)
  }

  return (
    <p className={done ? 'today-mission done' : 'today-mission'} aria-live="polite">
      <span className="mission-stamp" aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      {done ? t('missionDone') : t('missionTry')} <b lang={learningLang}>{item.text}</b>
      {!done && (
        <button type="button" className="text-button mission-next" onClick={next}>
          {t('missionNext')}
        </button>
      )}
    </p>
  )
}
