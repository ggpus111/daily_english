import { useApp } from '../context'
import { usePackData } from '../hooks/usePackData'
import { findPhrase } from '../lib/blank'
import { todayItem } from '../lib/packs'
import { usedEntries } from '../lib/usage'

/** 내가 모은 단어·표현 (표현 먼저) */
export function useMyEntries() {
  const { records } = useApp()
  return [...records.expression, ...records.word]
}

// 일기 번역에 쓴 내 단어·표현. live면 쓰는 동안 바뀔 때마다 보조 기술에 알린다.
export function UsageLine({ sentence, live = false }) {
  const { t } = useApp()
  const used = usedEntries(sentence, useMyEntries())
  const text = used.length > 0 ? t('usageFound', { count: used.length }) : live && sentence?.trim() ? t('usageNone') : ''

  return (
    <p className={used.length > 0 ? 'usage-line found' : 'usage-line'} aria-live={live ? 'polite' : undefined}>
      {text}
      {used.length > 0 && ' '}
      {used.map((entry, index) => (
        <span key={entry.id ?? entry.text}>
          {index > 0 && ', '}
          <b lang="en">{entry.text}</b>
        </span>
      ))}
    </p>
  )
}

// 오늘의 표현을 일기에 써 보는 작은 미션. 번역에 쓰면 바로 도장이 찍힌다.
export function TodayMission({ sentence }) {
  const { t } = useApp()
  const { data } = usePackData('expressions')
  if (!data) return null
  const item = todayItem(data.items)
  const done = Boolean(findPhrase(item.text, sentence))

  return (
    <p className={done ? 'today-mission done' : 'today-mission'} aria-live="polite">
      <span className="mission-stamp" aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      {done ? t('missionDone') : t('missionTry')} <b lang="en">{item.text}</b>
    </p>
  )
}
