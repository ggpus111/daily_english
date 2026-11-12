import { useId } from 'react'

export default function SearchField({ label, value, onChange }) {
  const id = useId()

  return (
    <div className="search-field" role="search">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
