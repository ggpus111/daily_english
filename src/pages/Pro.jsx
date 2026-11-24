import { useMemo } from 'react'
import BarChart from '../components/BarChart'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { INTERVAL_DAYS } from '../lib/review'
import { computeStats } from '../lib/stats'

// 발표용 시연판. 결제는 없고, 관리자가 지정한 계정만 Pro다(관리자 페이지 > Pro 회원).
// Pro는 "더 많이"가 아니라 "더 좋은 AI"가 핵심이다: Claude 교정과 대화 도우미, 학습 통계.

const FREE_FEATURES = ['proFree.record', 'proFree.review', 'proFree.backup', 'proFree.sync', 'proFree.copyAi']
const PRO_FEATURES = ['proPlus.ai', 'proPlus.polish', 'proPlus.explain', 'proPlus.report', 'proPlus.stats']
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
  const { t, records, nativeLang, isPro, go } = useApp()
  const locale = nativeLang === 'ko' ? 'ko-KR' : 'en-US'
  const stats = useMemo(() => computeStats(records), [records])

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
            {PRO_FEATURES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          {isPro ? (
            <>
              <p className="plan-member">{t('proMember')}</p>
              <button className="primary-button" onClick={() => go('helper')}>
                {t('proOpenHelper')}
              </button>
            </>
          ) : (
            <p className="tiny-note">{t('proHowToJoin')}</p>
          )}
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
        {isPro ? (
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
