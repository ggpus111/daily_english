import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { REPORT_NOTE_MAX, REPORT_REASONS, reportPackItem } from '../lib/packReports'
import { supabase } from '../lib/supabase'

/**
 * 꾸러미 카드 오른쪽 위의 "신고" 버튼. 이유를 골라 보내면 그 항목은 바로 꾸러미에서 빠진다.
 * 로그인해야 보낼 수 있다(한 사람이 하루에 보낼 수 있는 수가 정해져 있다). 창 모양은 설정의 선택 창과 같다.
 */
export default function ReportPackItem({ item, kind }) {
  const { t, notify, user, onLogin, learningLang } = useApp()
  const id = useId()
  const dialogRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (dialog.showModal) dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (dialog.close) dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  function start() {
    if (!supabase || !user) {
      notify(t('packReportNeedLogin'), supabase ? { label: t('packReportLogin'), onClick: onLogin } : undefined)
      return
    }
    setReason('')
    setNote('')
    setOpen(true)
  }

  async function send() {
    setSending(true)
    const result = await reportPackItem({ item, kind, reason, note, lang: learningLang })
    setSending(false)
    if (result.error) {
      if (result.error.kind === 'login') notify(t('packReportNeedLogin'))
      else if (result.error.kind === 'limit') notify(t('packReportLimit'))
      else notify(t('packReportError', { message: errorMessage(result.error, t) }))
      return
    }
    setOpen(false)
    notify(t('packReportDone'))
  }

  return (
    <>
      <button
        type="button"
        className="text-button pack-report"
        aria-haspopup="dialog"
        onClick={start}
      >
        {t('packReport')}
        <span className="sr-only"> {item.text}</span>
      </button>
      <dialog ref={dialogRef} className="choice-sheet" aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}>
        <fieldset className="choice-sheet-body">
          <legend id={`${id}-title`}>{t('packReportTitle', { text: item.text })}</legend>
          <p className="tiny-note">{t('packReportHelp')}</p>
          <div className="choice-sheet-list">
            {REPORT_REASONS.map((value) => (
              <label key={value} className={reason === value ? 'choice-sheet-item checked' : 'choice-sheet-item'}>
                <input
                  type="radio"
                  name={`${id}-reason`}
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                <span>{t(`packReportReason.${value}`)}</span>
              </label>
            ))}
          </div>
          <label className="pack-report-note-label" htmlFor={`${id}-note`}>
            {t('packReportNote')}
          </label>
          <textarea
            id={`${id}-note`}
            rows={2}
            maxLength={REPORT_NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </fieldset>
        <div className="button-row">
          <button type="button" className="primary-button" disabled={!reason || sending} onClick={send}>
            {t('packReportSend')}
          </button>
          <button type="button" className="soft-button" onClick={() => setOpen(false)}>
            {t('cancel')}
          </button>
        </div>
      </dialog>
    </>
  )
}
