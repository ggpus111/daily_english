import { useId } from 'react'

const CONTROLS = { input: 'input', textarea: 'textarea', select: 'select' }

export default function Field({ label, error, as = 'input', required, children, ...controlProps }) {
  const id = useId()
  const errorId = `${id}-error`
  const Control = CONTROLS[as]

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Control
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...controlProps}
      >
        {children}
      </Control>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}
