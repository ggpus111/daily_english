import { useMemo, useState } from 'react'
import BarChart from '../components/BarChart'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { INTERVAL_DAYS } from '../lib/review'
import { computeStats } from '../lib/stats'
import { local } from '../lib/storage'

// 발표용 시연판. 결제는 없고, "미리 보기"를 켜면 Pro 기능을 써 볼 수 있다.
const PREVIEW_KEY = 'proPreview'

const FREE_FEATURES = ['proFree.record', 'proFree.review', 'proFree.backup', 'proFree.sync', 'proFree.copyAi']
const PRO_FEATURES = [
  { key: 'proPlus.stats', status: 'proStatus.now' },
  { key: 'proPlus.ai', status: 'proStatus.launch' },
]
const PROMISES = ['proPromise.free', 'proPromise.notice', 'proPromise.cancel']

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value.toLocaleString()}</strong>
    </div>
  )
}

export default function Pro() {
  const { t, records, nativeLang } = useApp()
  const [preview, setPreview] = useState(() => local.get(PREVIEW_KEY) === '1')
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const stats = useMemo(() => computeStats(records), [records])

  function togglePreview() {
    const next = !preview
    setPreview(next)
    if (next) local.set(PREVIEW_KEY, '1')
    else local.remove(PREVIEW_KEY)
  }

  const day = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' })
  const fullDay = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const recent = stats.recent.map((item) => ({
    label: fullDay.format(item.date),
    short: day.format(item.date),
    value: item.count,
    tip: t('chartTip', { label: fullDay.format(item.date), count: item.count }),
  }))
  const upcoming = stats.upcoming.map((item, index) => {
    const label = index === 0 ? t('today') : weekday.format(item.date)
    return { label, value: item.count, tip: t('chartTip', { label, count: item.count }) }
  })
  const stages = stats.stages.map((item) => {
    const label = item.box === null ? t('stageNew') : t('stageBox', { n: item.box + 1 })
    const next = item.box === null ? t('stageNewNote') : t('stageNext', { days: INTERVAL_DAYS[item.box] })
    return { label, value: item.count, tip: `${label} · ${next}: ${item.count}` }
  })

  return (
    <>
      <PageHead title={t('pro')} intro={t('proIntro')} />
      <p className="demo-badge">{t('proDemoBadge')}</p>

      <div className="plan-grid">
        <section className="panel plan" aria-labelledby="plan-free">
          <h2 id="plan-free">{t('planFree')}</h2>
          <p className="plan-price">{t('planFreePrice')}</p>
          <ul className="plan-list">
            {FREE_FEATURES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>

        <section className="panel plan plan-pro" aria-labelledby="plan-pro">
          <h2 id="plan-pro">{t('planPro')}</h2>
          <p className="plan-price">{t('planProPrice')}</p>
          <p className="tiny-note">{t('planPriceNote')}</p>
          <ul className="plan-list">
            {PRO_FEATURES.map((feature) => (
              <li key={feature.key}>
                {t(feature.key)} <span className="plan-status">{t(feature.status)}</span>
              </li>
            ))}
          </ul>
          <button className="primary-button" aria-pressed={preview} onClick={togglePreview}>
            {t(preview ? 'proPreviewOff' : 'proPreviewOn')}
          </button>
        </section>
      </div>

      <section className="panel promise" aria-labelledby="promise-title">
        <h2 id="promise-title">{t('proPromiseTitle')}</h2>
        <ul className="plan-list">
          {PROMISES.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="tiny-note">{t('proPromiseWhy')}</p>
      </section>

      <section className="panel stats" aria-labelledby="stats-title">
        <div className="section-head">
          <h2 id="stats-title">{t('statsTitle')}</h2>
          <span className="count">{t('proBadge')}</span>
        </div>
        {preview ? (
          <>
            <div className="stat-tiles">
              <StatTile label={t('statTotal')} value={stats.total} />
              <StatTile label={t('statMonth')} value={stats.thisMonth} />
              <StatTile label={t('statStreak')} value={stats.streakDays} />
              <StatTile label={t('statReviewed')} value={stats.reviewed} />
            </div>
            <BarChart
              title={t('chartRecent')}
              data={recent}
              showTick={(index) => index % 7 === 0 || index === recent.length - 1}
              tableLabel={t('chartTable')}
              columns={[t('chartDate'), t('chartCount')]}
              empty={t('chartEmpty')}
            />
            <div className="chart-pair">
              <BarChart
                title={t('chartStages')}
                data={stages}
                orientation="bar"
                tableLabel={t('chartTable')}
                columns={[t('chartStage'), t('chartCount')]}
                empty={t('chartEmptyReview')}
              />
              <BarChart
                title={t('chartUpcoming')}
                data={upcoming}
                tableLabel={t('chartTable')}
                columns={[t('chartDate'), t('chartCount')]}
                empty={t('chartEmptyReview')}
              />
            </div>
            <p className="tiny-note">{t('statsPrivacy')}</p>
          </>
        ) : (
          <p className="muted">{t('statsLocked')}</p>
        )}
      </section>
    </>
  )
}
