import { useId } from 'react'

// 몇 개 중 하나를 고르는 칸. 휴대폰 기본 선택 창(회색 목록 팝업) 대신, 앱 색에 맞는 동글동글한 칩으로 바로 보여 준다.
// 안은 라디오 버튼이라 키보드(화살표)와 화면 읽기 프로그램에서도 그대로 동작한다.
// options: [{ value, label, icon? }]
export default function ChoiceChips({ label, name, options, value, onChange, hint, compact = false }) {
  const id = useId()
  const groupName = name ?? id

  return (
    <fieldset className="choice-field" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend>{label}</legend>
      <div className={compact ? 'choice-chips compact' : 'choice-chips'}>
        {options.map((option) => {
          const checked = String(option.value) === String(value)
          return (
            <label key={option.value} className={checked ? 'choice-chip checked' : 'choice-chip'}>
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              {option.icon && (
                <span className="choice-icon" aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {hint && (
        <p className="tiny-note" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </fieldset>
  )
}
