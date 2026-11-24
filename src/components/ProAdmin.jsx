import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { adminListPro, adminSetPro } from '../lib/pro'
import Field from './Field'

// 관리자 페이지의 "Pro 회원" 탭: 이메일로 Pro를 지정하고, 목록에서 해제한다. 결제가 생기기 전까지 쓰는 방법이다.
export default function ProAdmin() {
  const { t, notify } = useApp()
  const [members, setMembers] = useState(null)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const result = await adminListPro()
    if (result.error) notify(t('adminProError', { message: errorMessage(result.error, t) }))
    setMembers(result.members ?? [])
  }

  useEffect(() => {
    // 처음 열 때 목록을 받아 온다. 결과를 받은 뒤에만 상태를 바꾼다.
    let alive = true
    adminListPro().then((result) => {
      if (!alive) return
      if (result.error) notify(t('adminProError', { message: errorMessage(result.error, t) }))
      setMembers(result.members ?? [])
    })
    return () => {
      alive = false
    }
  }, [notify, t])

  async function change(target, enabled, memo = '') {
    setBusy(true)
    const result = await adminSetPro({ email: target, enabled, note: memo })
    setBusy(false)
    if (result.error) {
      notify(t('adminProError', { message: errorMessage(result.error, t) }))
      return false
    }
    notify(t(enabled ? 'adminProAdded' : 'adminProRemoved', { email: target }))
    await load()
    return true
  }

  async function submit(event) {
    event.preventDefault()
    if (!email.trim()) return
    if (await change(email, true, note)) {
      setEmail('')
      setNote('')
    }
  }

  return (
    <section className="panel stack-form" aria-labelledby="admin-pro-title">
      <h2 id="admin-pro-title">{t('adminPro')}</h2>
      <p className="muted">{t('adminProIntro')}</p>
      <form className="stack-form" onSubmit={submit} noValidate>
        <Field
          label={t('adminProEmail')}
          name="pro-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label={t('adminProNote')}
          name="pro-note"
          maxLength={200}
          autoComplete="off"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button className="primary-button" disabled={busy || !email.trim()}>
          {t('adminProAdd')}
        </button>
      </form>
      {members === null ? (
        <p className="tiny-note" role="status">
          {t('adminChecking')}
        </p>
      ) : members.length === 0 ? (
        <p className="empty-state">{t('adminProEmpty')}</p>
      ) : (
        <ul className="record-list">
          {members.map((member) => (
            <li className="journal-entry" key={member.email}>
              <strong>{member.email}</strong>
              {member.note && <p className="tiny-note">{member.note}</p>}
              <div className="row-actions">
                <button
                  type="button"
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => change(member.email, false)}
                >
                  {t('adminProRemove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
