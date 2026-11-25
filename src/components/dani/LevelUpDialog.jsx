import { useEffect, useRef } from 'react'
import { useApp } from '../../context'
import { LEVELS } from '../../lib/growth'
import Dani from '../Dani'

/** 다니가 다음 단계로 자랐을 때 한 번 뜨는 축하 창. Esc로도 닫힌다(브라우저 대화상자가 첫 버튼에 초점을 둔다). */
export default function LevelUpDialog({ level, colors, onClose }) {
  const { t, go } = useApp()
  const ref = useRef(null)
  const item = LEVELS[level]
  const next = LEVELS[level + 1]
  const last = !next

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dani-levelup"
      aria-labelledby="dani-levelup-title"
      onClose={onClose}
    >
      <p className="eyebrow">{t('daniLevelUpTag', { level: level + 1 })}</p>
      <span className="dani-levelup-art dani-pop">
        <Dani pose={item.id} mood="joy" colors={colors} size={150} />
      </span>
      <h2 id="dani-levelup-title">{t(last ? 'daniLevelUpLastTitle' : 'daniLevelUpTitle', { name: t(`daniLevel.${item.id}`) })}</h2>
      <p>
        {last
          ? t('daniLevelUpLastBody')
          : t('daniLevelUpBody', { next: t(`daniLevel.${next.id}`), points: next.min.toLocaleString() })}
      </p>
      <button className="primary-button" onClick={onClose}>
        {t('daniLevelUpOk')}
      </button>
      <button
        className="text-button"
        onClick={() => {
          onClose()
          go('dani')
        }}
      >
        {t('daniOpen')}
      </button>
    </dialog>
  )
}
