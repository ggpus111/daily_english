import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { dismissPackReports, listPackReports, restorePackItem } from '../lib/packReports'

/** 관리자: 사용자가 신고한 꾸러미 항목(신고되면 이미 숨겨져 있다). 잘못된 신고면 다시 보이게, 맞는 신고면 숨긴 채 정리한다. */
export default function PackReportAdmin() {
  const { t, notify } = useApp()
  const [state, setState] = useState({ loading: true, reports: [], error: null })

  const load = useCallback(async () => {
    const result = await listPackReports()
    setState({ loading: false, reports: result.reports ?? [], error: result.error ?? null })
  }, [])

  useEffect(() => {
    let alive = true
    listPackReports().then((result) => {
      if (alive) setState({ loading: false, reports: result.reports ?? [], error: result.error ?? null })
    })
    return () => {
      alive = false
    }
  }, [])

  async function act(action, itemId, done) {
    const result = await action(itemId)
    if (result.error) notify(t('adminPackReportError', { message: errorMessage(result.error, t) }))
    else notify(t(done))
    load()
  }

  return (
    <section className="panel" aria-labelledby="admin-pack-reports-title">
      <h2 id="admin-pack-reports-title">{t('adminPackReportsTitle')}</h2>
      <p className="muted">{t('adminPackReportsIntro')}</p>
      {state.loading ? (
        <p role="status">{t('adminChecking')}</p>
      ) : state.error ? (
        <p role="alert">{t('adminPackReportError', { message: errorMessage(state.error, t) })}</p>
      ) : state.reports.length === 0 ? (
        <p className="empty-state">{t('adminPackReportsEmpty')}</p>
      ) : (
        <ul className="record-list">
          {state.reports.map((report) => (
            <li key={report.item_id} className="record-row">
              <div>
                <strong>{report.item_text || report.item_id}</strong>
                <p className="muted">
                  {t('adminPackReportMeta', { kind: report.kind, id: report.item_id, count: report.count })}
                </p>
                <p>{report.reasons.map((reason) => t(`packReportReason.${reason}`)).join(', ')}</p>
                {report.notes.map((note) => (
                  <p key={note} className="tiny-note">
                    {note}
                  </p>
                ))}
              </div>
              <div className="row-actions">
                <button className="text-button" onClick={() => act(restorePackItem, report.item_id, 'adminPackRestored')}>
                  {t('adminPackRestore')}
                </button>
                <button
                  className="text-button"
                  onClick={() => act(dismissPackReports, report.item_id, 'adminPackKeptHidden')}
                >
                  {t('adminPackKeepHidden')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
