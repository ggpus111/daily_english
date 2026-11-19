import { Component } from 'react'
import { recordError } from '../lib/errorLog'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled app error:', error, info.componentStack)
    recordError(error, 'react')
  }

  render() {
    if (!this.state.failed) return this.props.children

    const { t } = this.props
    return (
      <main className="auth-shell">
        <section className="auth-card" role="alert">
          <h1>{t('crashTitle')}</h1>
          <p className="muted">{t('crashBody')}</p>
          <button className="primary-button" onClick={() => window.location.reload()}>
            {t('crashReload')}
          </button>
        </section>
      </main>
    )
  }
}
