import { useId } from 'react'

/** 켜고 끄는 스위치 한 줄(다른 앱 설정 화면과 같은 모양). 제목과 설명을 함께 읽어 준다. */
export default function Switch({ label, description, checked, onChange, disabled = false }) {
  const id = useId()
  return (
    <div className={`switch-row${disabled ? ' is-disabled' : ''}`}>
      <span className="switch-text">
        <span id={`${id}-label`}>{label}</span>
        {description && <small id={`${id}-desc`}>{description}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" aria-hidden="true" />
      </button>
    </div>
  )
}
