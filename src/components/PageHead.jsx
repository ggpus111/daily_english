export default function PageHead({ title, intro }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {intro && <p className="muted">{intro}</p>}
    </header>
  )
}
