import Dani from '../components/Dani'
import PageHead from '../components/PageHead'
import { useDaniState } from '../components/dani/DaniProvider'
import { useApp } from '../context'
import { DANI_COLORS, ITEM_UNLOCK_LEVEL, LEVELS, POINTS } from '../lib/growth'

const COLOR_GROUPS = ['hair', 'top', 'item']

/** 다니 꾸미기(머리·옷·헤드폰 색)와 성장 길(5단계, 점수 얻는 법). */
export default function DaniPage() {
  const { t } = useApp()
  const dani = useDaniState()
  const { stats, state, colors, setColors } = dani
  const level = LEVELS[state.level]
  const itemLocked = state.level < ITEM_UNLOCK_LEVEL

  return (
    <>
      <PageHead title={t('daniPageTitle')} intro={t('daniPageIntro')} />

      <div className="dani-preview">
        {/* 헤드폰이 아직 잠겨 있으면 헤드폰 없는 자세로 미리 본다 */}
        <Dani pose={itemLocked ? 'book' : 'cheer'} colors={colors} size={190} />
        <span className="dani-preview-tag">
          {t('daniPreviewTag', { level: state.level + 1, name: t(`daniLevel.${level.id}`), total: stats.points.toLocaleString() })}
        </span>
      </div>

      {COLOR_GROUPS.map((group) => {
        const locked = group === 'item' && itemLocked
        return (
          <fieldset className={locked ? 'dani-colors locked' : 'dani-colors'} key={group} disabled={locked}>
            <legend>
              {t(`daniColor.${group}`)}
              {locked && <small className="dani-lock">{t('daniItemLocked', { name: t(`daniLevel.${LEVELS[ITEM_UNLOCK_LEVEL].id}`) })}</small>}
            </legend>
            <div className="dani-swatches">
              {DANI_COLORS[group].map((color) => (
                <label className="dani-swatch" key={color}>
                  <input
                    type="radio"
                    name={`dani-${group}`}
                    value={color}
                    checked={colors[group] === color}
                    onChange={() => setColors({ ...colors, [group]: color })}
                  />
                  <i style={{ background: color }} aria-hidden="true" />
                  <span>{t(`daniSwatch.${color.slice(1)}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
      <p className="tiny-note">{t('daniSavedNote')}</p>

      <section className="home-section" aria-labelledby="dani-path-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GROWTH PATH</p>
            <h2 id="dani-path-title">{t('daniPathTitle')}</h2>
          </div>
        </div>
        <ol className="dani-path">
          {LEVELS.map((item, index) => {
            const status = index < state.level ? 'done' : index === state.level ? 'now' : 'locked'
            return (
              <li className={`dani-path-item ${status}`} key={item.id} aria-current={status === 'now' ? 'step' : undefined}>
                <span className="dani-tile">
                  <Dani pose={item.id} colors={colors} size={76} />
                </span>
                <strong>{t('daniLevelTag', { level: index + 1, total: LEVELS.length })} · {t(`daniLevel.${item.id}`)}</strong>
                <small>“{t(`daniLine.${item.id}`)}”</small>
                <em>
                  {status === 'done'
                    ? t('daniPathDone')
                    : status === 'now'
                      ? t('daniPathNow', { total: stats.points.toLocaleString() })
                      : t('daniPathAt', { points: item.min.toLocaleString() })}
                </em>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="home-section" aria-labelledby="dani-points-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HOW TO GROW</p>
            <h2 id="dani-points-title">{t('daniPointsTitle')}</h2>
          </div>
        </div>
        <ul className="dani-points">
          {[
            ['saved', POINTS.saved],
            ['correct', POINTS.correct],
            ['journal', POINTS.journal],
            ['corrected', POINTS.corrected],
            ['mission', POINTS.mission],
            ['streak7', POINTS.streak7],
          ].map(([key, value]) => (
            <li key={key}>
              {t(`daniPoint.${key}`)}
              <b>{t('daniPointValue', { points: value })}</b>
            </li>
          ))}
        </ul>
        <p className="tiny-note">{t('daniPointsNote')}</p>
      </section>
    </>
  )
}
