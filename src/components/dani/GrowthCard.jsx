import { useApp } from '../../context'
import { LEVELS } from '../../lib/growth'
import Dani from '../Dani'
import { useDaniState } from './DaniProvider'

/** 홈의 "다니의 영어 성장기" 카드: 지금 단계, 그 단계의 한마디, 다음 단계까지 남은 점수, 점수 내역. */
export default function GrowthCard() {
  const { t, go } = useApp()
  const dani = useDaniState()
  const { stats, state, colors } = dani
  const level = LEVELS[state.level]
  const next = state.next === null ? null : LEVELS[state.next]

  return (
    <section className="home-section" aria-labelledby="dani-card-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GROWING UP</p>
          <h2 id="dani-card-title">{t('daniTitle')}</h2>
        </div>
        <button className="soft-pill pill-button" onClick={() => go('dani')}>
          {t('daniOpen')}
        </button>
      </div>
      <div className="paper-card dani-growth">
        <span className="dani-tile dani-growth-art">
          <Dani pose={level.id} colors={colors} size={104} />
        </span>
        <div>
          <p className="eyebrow">{t('daniLevelTag', { level: state.level + 1, total: LEVELS.length })}</p>
          <p className="dani-level-name">{t(`daniLevel.${level.id}`)}</p>
          <p className="dani-line">“{t(`daniLine.${level.id}`)}”</p>
          <div
            className="goal-bar"
            role="progressbar"
            aria-label={t('daniProgressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
          >
            <span style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <p className="muted">
            {next
              ? t('daniToNext', { name: t(`daniLevel.${next.id}`), points: state.toNext.toLocaleString(), total: stats.points.toLocaleString() })
              : t('daniMaxed', { total: stats.points.toLocaleString() })}
          </p>
        </div>
        <ul className="dani-stats">
          <li>
            <strong>{stats.saved}</strong>
            <span>{t('daniStatSaved')}</span>
          </li>
          <li>
            <strong>{stats.correct}</strong>
            <span>{t('daniStatCorrect')}</span>
          </li>
          <li>
            <strong>{t('daniStatJournalCount', { count: stats.journals })}</strong>
            <span>{t('daniStatJournal')}</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
