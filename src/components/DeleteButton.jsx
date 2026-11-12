import { useEffect, useState } from 'react'
import { useApp } from '../context'

const CONFIRM_MS = 5000

// 첫 클릭은 확인 상태로 바꾸고, 잠시 안에 다시 누르면 삭제한다.
export default function DeleteButton({ onConfirm, label, confirmLabel, className = 'text-button danger' }) {
  const { t } = useApp()
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return undefined
    const timer = setTimeout(() => setArmed(false), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <button
      type="button"
      className={className}
      aria-live="polite"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? (confirmLabel ?? t('confirmDelete')) : (label ?? t('delete'))}
    </button>
  )
}
