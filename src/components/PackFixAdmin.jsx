import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { FIX_FIELDS, FIX_LIMITS, listPackFixes, removePackFix, savePackFix } from '../lib/packFixes'
import { forgetPackData, loadBasePackData } from '../lib/packs'
import { normalizeText } from '../lib/text'

const KINDS = { words: 'packKindWords', expressions: 'packKindExpressions' }
const MAX_RESULTS = 20

// 관리자 페이지의 "꾸러미 고치기": 신고로 받은 틀린 뜻·예문을 앱 업데이트 없이 바로 고치고, 맞지 않는 항목은 숨긴다.
// 고친 내용은 서버(pack_fixes)에 저장되고, 사용자 앱은 다음에 꾸러미를 열 때 받는다.
export default function PackFixAdmin() {
  const { t, notify, learningLang } = useApp()
  const [kind, setKind] = useState('words')
  const [base, setBase] = useState({})
  const [fixes, setFixes] = useState(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([loadBasePackData(kind, learningLang), listPackFixes(kind)]).then(
      ([data, result]) => {
        if (!alive) return
        setBase((current) => ({ ...current, [kind]: data }))
        if (result.error) setLoadError(errorMessage(result.error, t))
        else {
          setLoadError('')
          setFixes(result.fixes)
        }
      },
      (error) => alive && setLoadError(errorMessage(error, t)),
    )
    return () => {
      alive = false
    }
  }, [kind, t, refresh, learningLang])

  const items = base[kind]?.items
  const fixById = useMemo(() => new Map((fixes ?? []).map((fix) => [fix.item_id, fix])), [fixes])
  const results = useMemo(() => {
    const key = normalizeText(query)
    if (!items || !key) return []
    return items.filter((item) => normalizeText(item.text).includes(key) || item.meaning.includes(query.trim())).slice(0, MAX_RESULTS)
  }, [items, query])

  function chooseKind(next) {
    setKind(next)
    setFixes(null)
    setEditing(null)
    setQuery('')
  }

  async function done(result, message) {
    if (result.error) {
      notify(t('saveError', { message: errorMessage(result.error, t) }))
      return
    }
    forgetPackData(kind, learningLang)
    notify(t(message))
    setEditing(null)
    setRefresh((value) => value + 1)
  }

  const itemById = (id) => items?.find((item) => item.id === id)

  return (
    <section className="panel" aria-labelledby="admin-packs-title">
      <h2 id="admin-packs-title">{t('adminPacks')}</h2>
      <p className="muted">{t('adminPacksIntro')}</p>
      <div className="pack-kinds" role="group" aria-label={t('packKind')}>
        {Object.entries(KINDS).map(([id, label]) => (
          <button key={id} type="button" className="pack-kind" aria-pressed={id === kind} onClick={() => id !== kind && chooseKind(id)}>
            {t(label, { count: id === kind && items ? items.length : '' }).trim()}
          </button>
        ))}
      </div>
      {loadError && (
        <p className="wrong-text" role="alert">
          {loadError}
        </p>
      )}

      {editing ? (
        <PackFixForm
          key={editing.id}
          kind={kind}
          item={editing}
          fix={fixById.get(editing.id)}
          onCancel={() => setEditing(null)}
          onSave={async (values) => done(await savePackFix(kind, editing, values), 'adminPackSaved')}
          onReset={async () => done(await removePackFix(editing.id), 'adminPackReset')}
        />
      ) : (
        <>
          <div className="field">
            <label htmlFor="admin-pack-search">{t('adminPackSearch')}</label>
            <input
              id="admin-pack-search"
              type="search"
              value={query}
              placeholder={t('adminPackSearchHint')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {query.trim() && (
            <ul className="admin-list" aria-label={t('adminPackResults')}>
              {results.length === 0 && <li className="empty-state">{t('searchEmpty')}</li>}
              {results.map((item) => (
                <PackRow key={item.id} item={item} fix={fixById.get(item.id)} onEdit={() => setEditing(item)} />
              ))}
            </ul>
          )}

          <h3>{t('adminPackFixed')}</h3>
          {fixes === null ? (
            <p className="empty-state" role="status">
              {t('adminLoading')}
            </p>
          ) : fixes.length === 0 ? (
            <p className="empty-state">{t('adminPackNoFixes')}</p>
          ) : (
            <ul className="admin-list" aria-label={t('adminPackFixed')}>
              {fixes.map((fix) => {
                const item = itemById(fix.item_id)
                return item ? <PackRow key={fix.item_id} item={item} fix={fix} onEdit={() => setEditing(item)} /> : null
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function PackRow({ item, fix, onEdit }) {
  const { t, learningLang } = useApp()
  return (
    <li className="admin-item pack-fix-row">
      <div>
        <strong lang={learningLang}>{item.text}</strong> <span className="muted">{fix?.meaning ?? item.meaning}</span>
        {fix && (
          <span className={`report-status ${fix.hidden ? 'status-wontfix' : 'status-fixed'}`}>
            {t(fix.hidden ? 'adminPackHiddenBadge' : 'adminPackFixedBadge')}
          </span>
        )}
      </div>
      <button type="button" className="soft-button" aria-label={t('adminPackEditLabel', { text: item.text })} onClick={onEdit}>
        {t('adminPackEdit')}
      </button>
    </li>
  )
}

function PackFixForm({ kind, item, fix, onCancel, onSave, onReset }) {
  const { t, learningLang } = useApp()
  const initial = Object.fromEntries(Object.entries(FIX_FIELDS).map(([field, column]) => [field, fix?.[column] ?? item[field] ?? '']))
  const [values, setValues] = useState({ ...initial, hidden: fix?.hidden ?? false, note: fix?.note ?? '' })
  const [saving, setSaving] = useState(false)
  const fields = kind === 'expressions' ? ['meaning', 'example', 'exampleKo', 'tip'] : ['meaning', 'example', 'exampleKo']
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  async function run(action) {
    setSaving(true)
    await action()
    setSaving(false)
  }

  return (
    <form
      className="pack-fix-form"
      aria-labelledby="pack-fix-title"
      onSubmit={(event) => {
        event.preventDefault()
        run(() => onSave(values))
      }}
    >
      <h3 id="pack-fix-title">
        <span lang={learningLang}>{item.text}</span> <small className="muted">#{item.id}</small>
      </h3>
      {fields.map((field) => (
        <div className="field" key={field}>
          <label htmlFor={`fix-${field}`}>{t(`adminPackField.${field}`)}</label>
          <textarea id={`fix-${field}`} rows={field === 'meaning' ? 1 : 2} maxLength={FIX_LIMITS[field]} value={values[field]} onChange={set(field)} />
          {values[field] !== (item[field] ?? '') && (
            <small className="muted">
              {t('adminPackOriginal')}: {item[field] || '—'}
            </small>
          )}
        </div>
      ))}
      <label className="check-row">
        <input type="checkbox" checked={values.hidden} onChange={set('hidden')} />
        <span>{t('adminPackHide')}</span>
      </label>
      <div className="field">
        <label htmlFor="fix-note">{t('adminPackNote')}</label>
        <input id="fix-note" maxLength={FIX_LIMITS.note} value={values.note} placeholder={t('adminPackNoteHint')} onChange={set('note')} />
      </div>
      <div className="data-actions">
        <button className="primary-button" type="submit" disabled={saving}>
          {t('adminSave')}
        </button>
        {fix && (
          <button className="soft-button" type="button" disabled={saving} onClick={() => run(onReset)}>
            {t('adminPackResetButton')}
          </button>
        )}
        <button className="text-button" type="button" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
