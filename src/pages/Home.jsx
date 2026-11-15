import ExpressionCard from '../components/ExpressionCard'
import RecapCard from '../components/Recap'
import Mascot from '../components/Mascot'
import { useApp } from '../context'
import { activityDays, dayKey, lastSevenDays, streak } from '../lib/activity'
import { findPhrase } from '../lib/blank'
import { languageName } from '../lib/i18n'
import { usePackData } from '../hooks/usePackData'
import { todayItem } from '../lib/packs'
import { moodOf, moodTone } from '../lib/moods'
import { dueItems } from '../lib/review'
import { moodsByDay } from '../lib/usage'

// 친구 원본 홈(학습 노트)의 번호 카드 구성을 따른다.
const CARDS = [
  { page: 'words', type: 'word', eyebrow: '01 / VOCABULARY', count: 'cardWords', tone: 'peach', preview: 'text', learning: true },
  { page: 'expressions', type: 'expression', eyebrow: '02 / EXPRESSIONS', count: 'cardExpressions', tone: 'lilac', preview: 'text', learning: true },
  { page: 'chats', type: 'chat', eyebrow: '03 / CHAT NOTES', count: 'cardChats', tone: 'sage', preview: 'situation' },
  { page: 'journal', type: 'journal', eyebrow: '04 / DAILY JOURNAL', count: 'cardJournals', tone: 'butter', preview: 'native' },
]

// 날마다 바뀌는 한마디. 영어 문장과 우리말 풀이를 함께 둔다.
const NOTES = [
  { en: 'You don’t have to be perfect. Just keep showing up.', ko: '완벽하지 않아도 괜찮아. 꾸준히 돌아오는 게 중요해.' },
  { en: 'Small steps every day add up.', ko: '매일의 작은 걸음이 쌓여요.' },
  { en: 'One new word is still progress.', ko: '새 단어 하나도 분명한 한 걸음이에요.' },
  { en: 'Mistakes are proof that you are trying.', ko: '틀렸다는 건 해 보고 있다는 뜻이에요.' },
  { en: 'Rest is part of learning, too.', ko: '쉬는 것도 배우는 과정이에요.' },
  { en: 'The words you collect become your voice.', ko: '모은 말들이 결국 내 목소리가 돼요.' },
  { en: 'Slow is fine. Stopping for good is the only miss.', ko: '느려도 괜찮아요. 아주 멈추지만 않으면 돼요.' },
]

const DAY_MS = 24 * 60 * 60 * 1000

const isSameDay = (value, day) => new Date(value).toDateString() === day.toDateString()

export default function Home() {
  const { t, go, records, nickname, nativeLang, learningLang } = useApp()
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
  const note = NOTES[Math.floor(today.getTime() / DAY_MS) % NOTES.length]
  const totalRecords = Object.values(records).reduce((sum, items) => sum + items.length, 0)

  return (
    <>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-text">
          <p className="eyebrow">YOUR DAILY NOTE</p>
          <h1 id="welcome-title">{t('greetingNamed', { name: nickname })}</h1>
          <p className="muted">{t('subtitle')}</p>
        </div>
        <p className="welcome-date">
          <span aria-hidden="true">{dateParts.month}</span>
          <strong aria-hidden="true">{dateParts.day}</strong>
          <small aria-hidden="true">{dateParts.weekday}</small>
          <span className="sr-only">{fullDate.format(today)}</span>
        </p>
      </section>

      <section className="home-section" aria-labelledby="space-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LEARNING SPACE</p>
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
                <span className="dash-eyebrow" aria-hidden="true">
                  {card.eyebrow}
                </span>
                <strong>{t(card.page)}</strong>
                <span className="dash-count">
                  {t(card.count, { count: items.length })}
                  {badge && <em>{badge}</em>}
                </span>
                <span className="dash-recent" lang={latest && card.learning ? learningLang : undefined}>
                  {latest || t('cardEmpty')}
                </span>
                <span className="dash-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {learningLang === 'en' && (
        <section className="home-section" aria-labelledby="today-expression-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TODAY’S EXPRESSION</p>
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

      <section className="home-section" aria-labelledby="routine-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ROUTINE</p>
            <h2 id="routine-title">{t('routineTitle')}</h2>
          </div>
        </div>

        <div className="routine-grid">
          <section className="paper-card review-panel" aria-labelledby="review-title">
            <p className="eyebrow" aria-hidden="true">
              TODAY’S REVIEW
            </p>
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
            <button
              className="primary-button"
              disabled={dueTotal === 0}
              onClick={() => go(dueWords > 0 || dueExpressions === 0 ? 'words' : 'expressions')}
            >
              {t('reviewStart')}
            </button>
          </section>

          <section className="paper-card week-panel" aria-labelledby="week-title">
            <div className="section-head">
              <p className="eyebrow" aria-hidden="true">
                THIS WEEK
              </p>
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
                    {day.mood && ` · ${t('moodOfDay', { mood: day.mood })}`}
                  </span>
                </li>
              ))}
            </ol>
            {weekMoods.length > 0 && (
              <p className="week-moods" aria-hidden="true">
                {weekMoods.map((day) => (
                  <span key={day.date.toISOString()} className={`week-mood mood-${moodTone(day.mood)}`}>
                    {weekday.format(day.date)} <b lang="en">{day.mood}</b>
                    {nativeLang === 'ko' && <small> {moodOf(day.mood).ko}</small>}
                  </span>
                ))}
              </p>
            )}
            <p className="tiny-note">{t(streakDays > 0 ? 'streakNote' : 'streakEmpty')}</p>
          </section>
        </div>
      </section>

      <RecapCard today={today} />

      <section className="quote-panel" aria-label="A note to yourself">
        <Mascot size={46} mood="joy" />
        <div>
          <p className="eyebrow">A NOTE TO YOURSELF</p>
          <p className="quote-text" lang="en">
            “{note.en}”
          </p>
          {nativeLang === 'ko' && <p className="tiny-note">{note.ko}</p>}
        </div>
      </section>
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
