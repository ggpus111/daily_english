import { useState } from 'react'
import { useApp } from '../context'
import { CATEGORY_MAX, addCustomCategory, categoryLabel, categoryOptions } from '../lib/categories'
import ChoiceChips from './ChoiceChips'

/**
 * 기록의 카테고리 고르기. 기본 카테고리와 직접 만든 카테고리를 칩으로 보여 주고, "직접 추가"로 새 이름을 만들 수 있다.
 * optional이면 고르지 않아도 된다(value가 ''). 대화 기록처럼 꼭 하나를 고르는 곳은 optional={false}.
 */
export default function CategoryPicker({ type, items, value, onChange, optional = true, label }) {
  const { t } = useApp()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [, setVersion] = useState(0)
  const options = categoryOptions(type, items)

  function add() {
    const created = addCustomCategory(type, name, t)
    if (!created) return
    setVersion((count) => count + 1)
    onChange(created)
    setName('')
    setAdding(false)
  }

  return (
    <div className="category-picker">
      <ChoiceChips
        label={label ?? t('categoryLabel')}
        options={[
          ...(optional ? [{ value: '', label: t('categoryNone') }] : []),
          ...options.map((id) => ({ value: id, label: categoryLabel(id, t, type) })),
        ]}
        value={value ?? ''}
        onChange={onChange}
        compact
      />
      {adding ? (
        <div className="category-add">
          <label className="sr-only" htmlFor={`category-new-${type}`}>
            {t('categoryNewLabel')}
          </label>
          <input
            id={`category-new-${type}`}
            value={name}
            maxLength={CATEGORY_MAX}
            placeholder={t('categoryNewHint')}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
          />
          <button type="button" className="soft-button" onClick={add} disabled={!name.trim()}>
            {t('categoryAdd')}
          </button>
          <button type="button" className="text-button" onClick={() => setAdding(false)}>
            {t('cancel')}
          </button>
        </div>
      ) : (
        <button type="button" className="text-button" onClick={() => setAdding(true)}>
          {t('categoryNew')}
        </button>
      )}
    </div>
  )
}
