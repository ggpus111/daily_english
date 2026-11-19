import { useEffect, useState } from 'react'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { REPORT_STATUSES, checkAdmin, listClientErrors, listReports, updateReport } from '../lib/reports'
import { supabase } from '../lib/supabase'

// 관리자 페이지(#admin): 들어온 신고를 보고 상태와 답변을 바로 고친다. 앱 오류 보고도 묶어서 본다.
// 관리자인지는 서버(is_admin)가 정하고, 서버 정책(RLS)이 관리자가 아니면 읽기·고치기를 막는다.
export default function Admin() {
  const { t, user } = useApp()
  const signedIn = Boolean(supabase && user)
  const [allowed, setAllowed] = useState(signedIn ? null : false)
  const [tab, setTab] = useState('reports')

  useEffect(() => {
    if (!signedIn) return undefined
    let alive = true
    checkAdmin().then((value) => alive && setAllowed(value))
    return () => {
      alive = false
    }
  }, [signedIn, user])

  if (allowed === null) {
    return (
      <p className="empty-state" role="status">
        {t('adminChecking')}
      </p>
    )
  }
  if (!allowed) {
    return (
      <>
        <PageHead title={t('admin')} intro={t('adminOnly')} />
      </>
    )
  }

  return (
    <>
      <PageHead title={t('admin')} intro={t('adminIntro')} />
      <div className="pack-kinds" role="group" aria-label={t('admin')}>
        {['reports', 'errors'].map((id) => (
          <button key={id} type="button" className="pack-kind" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {t(id === 'reports' ? 'adminReports' : 'adminErrors')}
          </button>
        ))}
      </div>
      {tab === 'reports' ? <ReportsAdmin /> : <ErrorsAdmin />}
    </>
  )
}

function ReportsAdmin() {
  const { t, notify, nativeLang } = useApp()
  const [status, setStatus] = useState('')
  const [reports, setReports] = useState(null)
  const [loadError, setLoadError] = useState('')
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })

  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let alive = true
    listReports(status).then((result) => {
      if (!alive) return
      if (result.error) setLoadError(errorMessage(result.error, t))
      else {
        setLoadError('')
        setReports(result.reports)
      }
    })
    return () => {
      alive = false
    }
  }, [status, t, refresh])

  async function save(report, patch) {
    const result = await updateReport(report.id, { status: patch.status, admin_reply: patch.admin_reply })
    if (result.error) {
      notify(t('saveError', { message: errorMessage(result.error, t) }))
      return
    }
    notify(t('adminSaved'))
    setRefresh((value) => value + 1)
  }

  return (
    <section className="panel" aria-labelledby="admin-reports-title">
      <div className="section-head">
        <h2 id="admin-reports-title">{t('adminReports')}</h2>
        <div className="field compact-field">
          <label htmlFor="admin-status" className="sr-only">
            {t('adminFilter')}
          </label>
          <select id="admin-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t('adminAll')}</option>
            {REPORT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(`reportStatus.${item}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loadError && (
        <p className="wrong-text" role="alert">
          {loadError}
        </p>
      )}
      {reports === null ? (
        <p className="empty-state" role="status">
          {t('adminLoading')}
        </p>
      ) : reports.length === 0 ? (
        <p className="empty-state">{t('adminNoReports')}</p>
      ) : (
        <ul className="admin-list">
          {reports.map((report) => (
            <ReportItem key={report.id} report={report} dateFormat={dateFormat} onSave={save} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportItem({ report, dateFormat, onSave }) {
  const { t } = useApp()
  const [status, setStatus] = useState(report.status)
  const [reply, setReply] = useState(report.admin_reply)
  const changed = status !== report.status || reply !== report.admin_reply
  const statusId = `status-${report.id}`
  const replyId = `reply-${report.id}`

  return (
    <li className="admin-item">
      <div className="report-meta">
        <span className={`report-status status-${report.status}`}>{t(`reportStatus.${report.status}`)}</span>
        <small className="muted">
          #{report.id} · {t(`reportKind.${report.kind}`)} · {report.platform} {report.version} · #{report.page} ·{' '}
          {dateFormat.format(new Date(report.created_at))}
        </small>
      </div>
      <p className="admin-message">{report.message}</p>
      {report.error_log && (
        <details>
          <summary>{t('adminErrorLog')}</summary>
          <pre className="admin-log">{report.error_log}</pre>
        </details>
      )}
      <div className="admin-edit">
        <div className="field">
          <label htmlFor={statusId}>{t('adminStatus')}</label>
          <select id={statusId} value={status} onChange={(event) => setStatus(event.target.value)}>
            {REPORT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(`reportStatus.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={replyId}>{t('adminReply')}</label>
          <textarea id={replyId} rows={2} maxLength={2000} value={reply} onChange={(event) => setReply(event.target.value)} />
        </div>
        <button className="primary-button" disabled={!changed} onClick={() => onSave(report, { status, admin_reply: reply })}>
          {t('adminSave')}
        </button>
      </div>
    </li>
  )
}

function ErrorsAdmin() {
  const { t, nativeLang } = useApp()
  const [groups, setGroups] = useState(null)
  const [loadError, setLoadError] = useState('')
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })

  useEffect(() => {
    listClientErrors().then((result) => {
      if (result.error) setLoadError(errorMessage(result.error, t))
      else setGroups(result.groups)
    })
  }, [t])

  return (
    <section className="panel" aria-labelledby="admin-errors-title">
      <h2 id="admin-errors-title">{t('adminErrors')}</h2>
      <p className="muted">{t('adminErrorsIntro')}</p>
      {loadError && (
        <p className="wrong-text" role="alert">
          {loadError}
        </p>
      )}
      {groups === null ? (
        <p className="empty-state" role="status">
          {t('adminLoading')}
        </p>
      ) : groups.length === 0 ? (
        <p className="empty-state">{t('adminNoErrors')}</p>
      ) : (
        <ul className="admin-list">
          {groups.map((group) => (
            <li key={`${group.message}|${group.page}`} className="admin-item">
              <div className="report-meta">
                <span className="report-status status-new">{t('adminErrorTimes', { count: group.total })}</span>
                <small className="muted">
                  #{group.page} · {group.platforms.join(', ')} · {group.versions.join(', ')} · {dateFormat.format(new Date(group.last))}
                </small>
              </div>
              <p className="admin-message">{group.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
