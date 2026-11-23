import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../../context'

/**
 * 설정의 한 줄: 이름과 지금 고른 값을 보여 주고, 누르면 고르는 창이 열린다(다른 앱 설정 화면처럼).
 * 창 안은 라디오 버튼이라 키보드와 화면 읽기 프로그램에서도 그대로 동작한다.
 * options: [{ value, label }]
 */
export default function ChoiceRow({ label, name, options, value, onChange, hint }) {
  const { t } = useApp()
  const id = useId()
  const dialogRef = useRef(null)
  const [open, setOpen] = useState(false)
  const current = options.find((option) => String(option.value) === String(value))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (dialog.showModal) dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (dialog.close) dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  // 창 바깥(어두운 배경)을 누르면 닫는다. 배경은 dialog 자신이 눌린 것으로 들어온다.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const closeOnBackdrop = (event) => {
      if (event.target === dialog) setOpen(false)
    }
    dialog.addEventListener('click', closeOnBackdrop)
    return () => dialog.removeEventListener('click', closeOnBackdrop)
  }, [])

  return (
    <>
      <button type="button" className="s-row" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="s-row-label">{label}</span>
        <span className="s-row-value">{current?.label}</span>
        <span className="s-row-chevron" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className="choice-sheet"
        aria-labelledby={`${id}-title`}
        onClose={() => setOpen(false)}
      >
        <fieldset className="choice-sheet-body">
          <legend id={`${id}-title`}>{label}</legend>
          <div className="choice-sheet-list">
            {options.map((option) => {
              const checked = String(option.value) === String(value)
              return (
                <label key={option.value} className={checked ? 'choice-sheet-item checked' : 'choice-sheet-item'}>
                  <input
                    type="radio"
                    name={name ?? id}
                    value={option.value}
                    checked={checked}
                    onChange={() => onChange(option.value)}
                    onClick={() => setOpen(false)}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
          {hint && <p className="tiny-note">{hint}</p>}
        </fieldset>
        <button type="button" className="soft-button choice-sheet-close" onClick={() => setOpen(false)}>
          {t('choiceClose')}
        </button>
      </dialog>
    </>
  )
}
