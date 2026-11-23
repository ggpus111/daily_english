import { useState } from 'react'
import ExpressionCard from '../components/ExpressionCard'
import Onboarding, { needsOnboarding } from '../components/Onboarding'
import BackupNudge from '../components/BackupNudge'
import RecapCard from '../components/Recap'
import { useApp } from '../context'
import { activityDays, dayKey, lastSevenDays, streak } from '../lib/activity'
import { findPhrase } from '../lib/blank'
import { languageName } from '../lib/i18n'
import { usePackData } from '../hooks/usePackData'
import { hasPackData, todayItem } from '../lib/packs'
import { moodMeaning, moodOf, moodTone, moodWord } from '../lib/moods'
import { readSettings, todayProgress } from '../lib/reminders'
import { dueItems, weakItems } from '../lib/review'
import { moodsByDay } from '../lib/usage'

// 친구 원본 홈(학습 노트)의 번호 카드 구성을 따른다.
const CARDS = [
  {
    page: 'words',
    type: 'word',
    count: 'cardWords',
    tone: 'peach',
    preview: 'text',
    learning: true,
  },
  {
    page: 'expressions',
    type: 'expression',
    count: 'cardExpressions',
    tone: 'lilac',
    preview: 'text',
    learning: true,
  },
  { page: 'chats', type: 'chat', count: 'cardChats', tone: 'sage', preview: 'situation' },
  {
    page: 'journal',
    type: 'journal',
    count: 'cardJournals',
    tone: 'butter',
    preview: 'native',
  },
]

const isSameDay = (value, day) => new Date(value).toDateString() === day.toDateString()

export default function Home() {
  const { t, go, records, nickname, nativeLang, learningLang, coupleUnread } = useApp()
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const today = new Date()
  // 날짜 블록은 친구 원본처럼 영어로 쓰고, 보조 기술에는 사용자 언어로 읽어 준다.
  const dateParts = {
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(today),
    day: today.getDate(),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today),
  }
  const fullDate = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })

  const days = activityDays(records)
  const dayMoods = moodsByDay(records.journal)
  const week = lastSevenDays(days, today).map((day) => ({ ...day, mood: dayMoods.get(dayKey(day.date)) ?? null }))
  const weekMoods = week.filter((day) => day.mood)
  const streakDays = streak(days, today)
  const dueWords = dueItems(records.word).length
  const dueExpressions = dueItems(records.expression).length
  const dueTotal = dueWords + dueExpressions
  const weakTotal = weakItems(records.word).length + weakItems(records.expression).length
  const totalRecords = Object.values(records).reduce((sum, items) => sum + items.length, 0)
  const { goal } = readSettings()
  const doneToday = todayProgress(records, today)
  // 기록이 하나도 없는 첫 실행이면 홈 대신 짧은 안내를 보여 준다.
  const [onboarding, setOnboarding] = useState(() => needsOnboarding(records, learningLang))

  if (onboarding) return <Onboarding onDone={() => setOnboarding(false)} />

  return (
    <>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-text">
          <h1 id="welcome-title">{t('greetingNamed', { name: nickname })}</h1>
        </div>
        <p className="welcome-date">
          <span aria-hidden="true">{dateParts.month}</span>
          <strong aria-hidden="true">{dateParts.day}</strong>
          <small aria-hidden="true">{dateParts.weekday}</small>
          <span className="sr-only">{fullDate.format(today)}</span>
        </p>
      </section>

      <BackupNudge totalRecords={totalRecords} />

      <section className="home-section" aria-labelledby="routine-title">
        <div className="section-heading">
          <div>
            <h2 id="routine-title">{t('routineTitle')}</h2>
          </div>
        </div>

        <div className="routine-grid">
          <section className="paper-card review-panel" aria-labelledby="review-title">
            <h3 id="review-title" className="sr-only">
              {t('reviewTitle')}
            </h3>
            <p className="review-count">
              <strong>{dueTotal}</strong>
              {t('reviewUnit')}
            </p>
            <p className="muted">
              {dueTotal > 0
                ? t('reviewBreakdown', { words: dueWords, expressions: dueExpressions })
                : t('reviewNoneToday')}
            </p>
            {goal > 0 && (
              <div className="goal-progress">
                <p>{doneToday >= goal ? t('goalDone', { goal }) : t('goalLeft', { done: doneToday, goal })}</p>
                <div
                  className="goal-bar"
                  role="progressbar"
                  aria-label={t('goalLabel')}
                  aria-valuemin={0}
                  aria-valuemax={goal}
                  aria-valuenow={Math.min(doneToday, goal)}
                >
                  <span style={{ width: `${Math.min(100, (doneToday / goal) * 100)}%` }} />
                </div>
              </div>
            )}
            <button
              className="primary-button"
              disabled={dueTotal === 0}
              onClick={() => go(dueWords > 0 || dueExpressions === 0 ? 'words' : 'expressions')}
            >
              {t('reviewStart')}
            </button>
            {weakTotal > 0 && (
              <button className="text-button" onClick={() => go('missed')}>
                {t('missedHomeLink', { count: weakTotal })}
              </button>
            )}
          </section>

          <section className="paper-card week-panel" aria-labelledby="week-title">
            <div className="section-head">
              <h3 id="week-title" className="sr-only">
                {t('weekTitle')}
              </h3>
              <span className="count">{t('streakDays', { count: streakDays })}</span>
            </div>
            <ol className="week-strip">
              {week.map((day) => (
                <li key={day.date.toISOString()} className={day.isToday ? 'today' : ''}>
                  <span
                    className={`stamp ${day.active ? 'on' : ''} ${day.mood ? `mood-${moodTone(day.mood)}` : ''}`}
                    aria-hidden="true"
                  >
                    {day.active ? '✓' : ''}
                  </span>
                  <span className="weekday" aria-hidden="true">
                    {weekday.format(day.date)}
                  </span>
                  <span className="sr-only">
                    {fullDate.format(day.date)} {t(day.active ? 'dayActive' : 'dayRest')}
                    {day.mood && ` · ${t('moodOfDay', { mood: moodWord(moodOf(day.mood), learningLang) })}`}
                  </span>
                </li>
              ))}
            </ol>
            {weekMoods.length > 0 && (
              <p className="week-moods" aria-hidden="true">
                {weekMoods.map((day) => (
                  <span key={day.date.toISOString()} className={`week-mood mood-${moodTone(day.mood)}`}>
                    {weekday.format(day.date)} <b lang={learningLang}>{moodWord(moodOf(day.mood), learningLang)}</b>
                    <small> {moodMeaning(moodOf(day.mood), learningLang)}</small>
                  </span>
                ))}
              </p>
            )}
            <p className="tiny-note">{t(streakDays > 0 ? 'streakNote' : 'streakEmpty')}</p>
          </section>
        </div>
      </section>

      <section className="home-section" aria-labelledby="space-title">
        <div className="section-heading">
          <div>
            <h2 id="space-title">{t('spaceTitle')}</h2>
          </div>
          <span className="soft-pill">{t('studying', { lang: languageName(learningLang, nativeLang) })}</span>
        </div>

        <div className="dash-grid">
          {CARDS.map((card) => {
            const items = records[card.type]
            const addedToday = items.filter((item) => isSameDay(item.createdAt, today)).length
            const latest = items[0]?.[card.preview]
            const badge =
              addedToday > 0
                ? t('todayAdded', { count: addedToday })
                : card.type === 'journal' && items.length > 0
                  ? t('journalNotYet')
                  : null
            return (
              <button key={card.page} className={`dash-card ${card.tone}`} onClick={() => go(card.page)}>
                <strong>{t(card.page)}</strong>
                <span className="dash-count">
                  {t(card.count, { count: items.length })}
                  {badge && <em>{badge}</em>}
                </span>
                <span className="dash-recent" lang={latest && card.learning ? learningLang : undefined}>
                  {latest || t('cardEmpty')}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="home-section" aria-labelledby="couple-card-title">
        <button className="paper-card couple-home" onClick={() => go('couple')}>
          <strong id="couple-card-title">{t('homeCoupleTitle')}</strong>
          <span className="muted">{coupleUnread ? t('coupleNewBody') : t('homeCoupleBody')}</span>
          {coupleUnread && <em className="couple-new-badge">{t('coupleNewBadge')}</em>}
        </button>
      </section>

      {hasPackData('expressions', learningLang) && (
        <section className="home-section" aria-labelledby="today-expression-title">
          <div className="section-heading">
            <div>
              <h2 id="today-expression-title">{t('todayExpression')}</h2>
            </div>
            <button className="soft-pill pill-button" onClick={() => go('packs')}>
              {t('packsMore')}
            </button>
          </div>
          {totalRecords === 0 && <p className="tiny-note today-hint">{t('packsFirstHint')}</p>}
          <TodayExpression today={today} />
        </section>
      )}

      <RecapCard today={today} />
    </>
  )
}

// 꾸러미 데이터는 따로 불러오므로, 오는 동안에는 같은 높이의 빈 카드를 둔다.
function TodayExpression({ today }) {
  const { t, go, records } = useApp()
  const { data, error } = usePackData('expressions')
  if (error) return <p className="tiny-note">{t('packsLoadError')}</p>
  if (!data) return <div className="expression-card expression-placeholder" aria-hidden="true" />
  const item = todayItem(data.items, today)
  // 오늘 쓴 일기 번역에 오늘의 표현이 들어 있으면 미션 완료
  const done = records.journal.some(
    (journal) => isSameDay(journal.createdAt, today) && findPhrase(item.text, journal.translation),
  )
  return (
    <>
      <ExpressionCard item={item} />
      <div className={done ? 'mission-row done' : 'mission-row'}>
        {done ? (
          <p>
            <span className="mission-stamp" aria-hidden="true">
              ✓
            </span>
            {t('missionHomeDone')}
          </p>
        ) : (
          <>
            <p>{t('missionHome')}</p>
            <button className="soft-button" onClick={() => go('journal')}>
              {t('missionGo')}
            </button>
          </>
        )}
      </div>
    </>
  )
}
