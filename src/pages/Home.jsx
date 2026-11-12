import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { useApp } from '../context'
import { activityDays, lastSevenDays, streak } from '../lib/activity'
import { languageName } from '../lib/i18n'
import { dueItems } from '../lib/review'

const STATS = [
  { page: 'words', type: 'word', label: 'savedWords', tone: 'peach' },
  { page: 'expressions', type: 'expression', label: 'savedExpressions', tone: 'lilac' },
  { page: 'chats', type: 'chat', label: 'savedChats', tone: 'sage' },
  { page: 'journal', type: 'journal', label: 'savedJournals', tone: 'butter' },
]

const RECENT_LIMIT = 3

export default function Home() {
  const { t, go, records, nickname, nativeLang, learningLang } = useApp()
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const today = new Date()
  const date = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long' }).format(today)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const fullDate = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long' })

  const days = activityDays(records)
  const week = lastSevenDays(days, today)
  const streakDays = streak(days, today)
  const dueWords = dueItems(records.word).length
  const dueExpressions = dueItems(records.expression).length
  const dueTotal = dueWords + dueExpressions
  const wroteToday = records.journal.some(
    (item) => new Date(item.createdAt).toDateString() === today.toDateString(),
  )
  const recentWords = records.word.slice(0, RECENT_LIMIT)

  return (
    <>
      <header className="home-hero">
        <Mascot size={72} />
        <div className="hero-text">
          <p className="muted">
            {date} · {t('studying', { lang: languageName(learningLang, nativeLang) })}
          </p>
          <h1>{t('greetingName', { name: nickname })}</h1>
          <p className="speech">{t('greeting')}</p>
        </div>
      </header>

      <div className="home-top">
        <section className="panel week-panel" aria-labelledby="week-title">
          <div className="section-head">
            <h2 id="week-title">{t('weekTitle')}</h2>
            <span className="count">{t('streakDays', { count: streakDays })}</span>
          </div>
          <ol className="week-strip">
            {week.map((day) => (
              <li key={day.date.toISOString()} className={day.isToday ? 'today' : ''}>
                <span className={`dot ${day.active ? 'on' : ''}`} aria-hidden="true" />
                <span className="weekday" aria-hidden="true">
                  {weekday.format(day.date)}
                </span>
                <span className="sr-only">
                  {fullDate.format(day.date)} {t(day.active ? 'dayActive' : 'dayRest')}
                </span>
              </li>
            ))}
          </ol>
          <p className="tiny-note">{t(streakDays > 0 ? 'streakNote' : 'streakEmpty')}</p>
        </section>

        <section className="panel review-panel" aria-labelledby="review-title">
          <h2 id="review-title">{t('reviewTitle')}</h2>
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
      </div>

      <div className="stat-grid">
        {STATS.map((stat) => (
          <button key={stat.page} className={`stat-card ${stat.tone}`} onClick={() => go(stat.page)}>
            <span className="stat-top">
              {t(stat.label)}
              <Icon name={stat.page} size={18} />
            </span>
            <strong>{records[stat.type].length}</strong>
          </button>
        ))}
      </div>

      <div className="home-grid">
        <section className="panel">
          <div className="section-head">
            <h2>{t('recentWords')}</h2>
            <button className="text-button" onClick={() => go('words')}>
              {t('viewAll')}
            </button>
          </div>
          {recentWords.length === 0 ? (
            <div className="empty-state">
              <Mascot size={48} mood="calm" />
              <p>{t('recentWordsEmpty')}</p>
              <button className="soft-button" onClick={() => go('words')}>
                {t('addFirstWord')}
              </button>
            </div>
          ) : (
            <ul>
              {recentWords.map((item) => (
                <li className="recent-row" key={item.id}>
                  <strong lang={learningLang}>{item.text}</strong>
                  <span className="muted">{item.meaning}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel nudge">
          <h2>{t(wroteToday ? 'journalDone' : 'journalTodo')}</h2>
          <p className="muted">{t(wroteToday ? 'journalDoneBody' : 'journalTodoBody')}</p>
          <button className="soft-button" onClick={() => go('journal')}>
            {t(wroteToday ? 'openJournal' : 'writeJournal')}
          </button>
        </section>
      </div>
    </>
  )
}
