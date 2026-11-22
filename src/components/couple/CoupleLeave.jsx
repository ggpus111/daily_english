import { useState } from 'react'
import { useApp } from '../../context'

/** 짝 그만두기: 한 번 더 확인한 뒤에만 한다. */
export default function CoupleLeave({ busy, onLeave }) {
  const { t } = useApp()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <div className="couple-leave">
        <button className="soft-button" onClick={() => setConfirming(true)}>
          {t('coupleLeave')}
        </button>
      </div>
    )
  }
  return (
    <div className="couple-leave">
      <p>{t('coupleLeaveConfirm')}</p>
      <div className="button-row">
        <button className="soft-button" disabled={busy} onClick={onLeave}>
          {t('coupleLeave')}
        </button>
        <button className="soft-button" onClick={() => setConfirming(false)}>
          {t('coupleKeep')}
        </button>
      </div>
    </div>
  )
}
