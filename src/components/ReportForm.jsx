import { useEffect, useState } from 'react'
import ChoiceChips from './ChoiceChips'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { readErrorLog } from '../lib/errorLog'
import { MAX_MESSAGE, REPORT_KINDS, listMyReports, submitReport } from '../lib/reports'
import { supabase } from '../lib/supabase'
import Field from './Field'

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

// 프로필의 "문제 신고·의견": 로그인했으면 앱 안에서 보내고 답변을 받는다. 로그인 전이면 이메일로 안내한다.
export default function ReportForm() {
  const { t, notify, user, nativeLang } = useApp()
  const [kind, setKind] = useState('bug')
  const [message, setMessage] = useState('')
  const [includeErrors, setIncludeErrors] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [mine, setMine] = useState([])
  const errorCount = readErrorLog().length
  const canSend = Boolean(supabase && user)
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium' })

  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!canSend) return undefined
    let alive = true
    listMyReports(user.id).then((result) => {
      if (alive && result.reports) setMine(result.reports)
    })
    return () => {
      alive = false
    }
  }, [canSend, user, refresh])

  async function send(event) {
    event.preventDefault()
    if (!message.trim()) {
      setError(t('fieldRequired'))
      return
    }
    setSending(true)
    const result = await submitReport({ kind, message, includeErrors: includeErrors && errorCount > 0 })
    setSending(false)
    if (result.error) {
      notify(t('saveError', { message: errorMessage(result.error, t) }))
      return
    }
    setMessage('')
    notify(t('reportSent'))
    setRefresh((value) => value + 1)
  }

  return (
    <section className="panel stack-form" aria-labelledby="report-title" id="report">
      <h2 id="report-title">{t('reportTitle')}</h2>
      <p className="muted">{t('reportBody')}</p>

      {canSend ? (
        <form className="stack-form" onSubmit={send} noValidate>
          <ChoiceChips
            label={t('reportKind')}
            name="report-kind"
            value={kind}
            options={REPORT_KINDS.map((item) => ({ value: item, label: t(`reportKind.${item}`) }))}
            onChange={setKind}
          />
          <Field
            as="textarea"
            label={t('reportMessage')}
            name="message"
            rows={4}
            required
            maxLength={MAX_MESSAGE}
            placeholder={t('reportMessageHint')}
            value={message}
            error={error}
            onChange={(event) => {
              setError('')
              setMessage(event.target.value)
            }}
          />
          {errorCount > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={includeErrors} onChange={(event) => setIncludeErrors(event.target.checked)} />
              <span>
                {t('reportIncludeErrors', { count: errorCount })}
                <small>{t('reportIncludeErrorsNote')}</small>
              </span>
            </label>
          )}
          <button className="primary-button" disabled={sending}>
            {t('reportSend')}
          </button>
        </form>
      ) : (
        <p className="tiny-note">
          {CONTACT_EMAIL ? (
            <>
              {t('reportNeedLogin')}{' '}
              <a className="inline-link" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Daily English 문제 신고')}`}>
                {CONTACT_EMAIL}
              </a>
            </>
          ) : (
            t('reportNeedLoginNoMail')
          )}
        </p>
      )}

      {mine.length > 0 && (
        <>
          <h3 className="recap-subtitle">{t('reportMine')}</h3>
          <ul className="report-list">
            {mine.map((report) => (
              <li key={report.id}>
                <div className="report-meta">
                  <span className={`report-status status-${report.status}`}>{t(`reportStatus.${report.status}`)}</span>
                  <small className="muted">
                    {t(`reportKind.${report.kind}`)} · {dateFormat.format(new Date(report.created_at))}
                  </small>
                </div>
                <p>{report.message}</p>
                {report.admin_reply && (
                  <p className="report-reply">
                    <b>{t('reportReply')}</b> {report.admin_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
