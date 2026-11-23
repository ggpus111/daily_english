import { useApp } from '../context'
import { moodMeaning, moodOf, moodTone, moodWord } from '../lib/moods'
import { weeklyRecap } from '../lib/usage'

// 이번 주(오늘 포함 7일) 돌아보기: 모은 말, 일기에 쓴 내 표현, 기분.
export default function RecapCard({ today }) {
  const { t, records, nativeLang, learningLang } = useApp()
  const recap = weeklyRecap(records, today)
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const short = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const start = new Date(today)
  start.setDate(start.getDate() - 6)
  const range = `${short.format(start)} – ${short.format(today)}`
  const stats = [
    { key: 'recapWords', value: recap.newWords },
    { key: 'recapExpressions', value: recap.newExpressions },
    { key: 'recapJournals', value: recap.journals },
    { key: 'recapReviewed', value: recap.reviewed },
  ]
  const dayLabel = (day) => weekday.format(new Date(`${day}T12:00:00`))

  return (
    <section className="home-section" aria-labelledby="recap-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WEEKLY RECAP</p>
          <h2 id="recap-title">{t('recapTitle')}</h2>
        </div>
        <span className="soft-pill">{range}</span>
      </div>
      <div className="paper-card recap-card">
        <dl className="recap-stats">
          {stats.map((stat) => (
            <div key={stat.key}>
              <dt>{t(stat.key)}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>

        <h3 className="recap-subtitle">{t('recapUsedTitle')}</h3>
        {recap.used.length > 0 ? (
          <ul className="recap-chips">
            {recap.used.map((text) => (
              <li key={text} lang={learningLang}>
                {text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiny-note">{t('recapUsedEmpty')}</p>
        )}

        <h3 className="recap-subtitle">{t('recapMoodTitle')}</h3>
        {recap.moods.length > 0 ? (
          <ul className="recap-moods">
            {recap.moods.map((item, index) => (
              <li key={`${item.day}-${index}`} className={`mood-${moodTone(item.mood)}`}>
                <small>{dayLabel(item.day)}</small> <b lang={learningLang}>{moodWord(moodOf(item.mood), learningLang)}</b>
                <small> {moodMeaning(moodOf(item.mood), learningLang)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tiny-note">{t('recapMoodEmpty')}</p>
        )}
      </div>
    </section>
  )
}
