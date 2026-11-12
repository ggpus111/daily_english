import { useMemo, useState } from 'react'
import Field from '../components/Field'
import PageHead from '../components/PageHead'
import SearchField from '../components/SearchField'
import { useApp } from '../context'
import { useRecordForm } from '../hooks/useRecordForm'
import { CATEGORIES } from '../lib/i18n'
import { matchesQuery } from '../lib/text'

const EMPTY_FORM = { situation: '', message: '', meaning: '', category: 'daily', note: '' }
const REQUIRED = ['situation', 'message', 'meaning']

export default function Chats() {
  const { t, records, learningLang } = useApp()
  const items = records.chat
  const recordForm = useRecordForm({ type: 'chat', emptyForm: EMPTY_FORM, required: REQUIRED })
  const { form, errors, editingId, saving, formRef, listRef, setField } = recordForm
  const [openId, setOpenId] = useState(null)
  const [query, setQuery] = useState('')

  const visible = useMemo(
    () =>
      items.filter((item) =>
        matchesQuery(query, [
          item.situation,
          item.message,
          item.meaning,
          t(`category.${item.category}`),
        ]),
      ),
    [items, query, t],
  )

  return (
    <>
      <PageHead title={t('chats')} intro={t('chatIntro')} />

      <div className="two-column">
        <form className="panel stack-form" ref={formRef} onSubmit={recordForm.submit} noValidate>
          <h2>{t(editingId ? 'editChat' : 'newChat')}</h2>
          <Field
            label={t('situation')}
            name="situation"
            required
            maxLength={300}
            autoComplete="off"
            placeholder={t('situationHint')}
            value={form.situation}
            error={errors.situation}
            onChange={(event) => setField('situation', event.target.value)}
          />
          <Field
            as="textarea"
            label={t('message')}
            name="message"
            required
            rows={2}
            maxLength={2000}
            value={form.message}
            error={errors.message}
            onChange={(event) => setField('message', event.target.value)}
          />
          <Field
            label={t('meaning')}
            name="meaning"
            required
            maxLength={2000}
            autoComplete="off"
            placeholder={t('chatMeaningHint')}
            value={form.meaning}
            error={errors.meaning}
            onChange={(event) => setField('meaning', event.target.value)}
          />
          <Field
            as="select"
            label={t('category')}
            name="category"
            value={form.category}
            onChange={(event) => setField('category', event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`category.${category}`)}
              </option>
            ))}
          </Field>
          <Field
            as="textarea"
            label={t('note')}
            name="note"
            rows={3}
            maxLength={2000}
            placeholder={t('noteHint')}
            value={form.note}
            onChange={(event) => setField('note', event.target.value)}
          />
          <button className="primary-button" disabled={saving}>
            {t(editingId ? 'editDone' : 'chatSave')}
          </button>
          {editingId && (
            <button type="button" className="text-button" onClick={recordForm.reset}>
              {t('cancel')}
            </button>
          )}
        </form>

        <section className="panel" aria-labelledby="chat-list">
          <div className="section-head">
            <h2 id="chat-list" ref={listRef} tabIndex={-1}>
              {t('memories')}
            </h2>
            <span className="count">{t('count', { count: items.length })}</span>
          </div>
          <SearchField label={t('chatSearch')} value={query} onChange={setQuery} />
          {visible.length === 0 ? (
            <p className="empty-state">{t(items.length === 0 ? 'empty' : 'searchEmpty')}</p>
          ) : (
            <ul className="record-list">
              {visible.map((item) => {
                const open = openId === item.id
                const detailId = `chat-detail-${item.id}`
                return (
                  <li className="chat-memory" key={item.id}>
                    <button
                      className="chat-summary"
                      aria-expanded={open}
                      aria-controls={detailId}
                      onClick={() => setOpenId(open ? null : item.id)}
                    >
                      <span className="chat-summary-text">
                        <strong>{item.situation}</strong>
                        <small>{t(`category.${item.category}`)}</small>
                      </span>
                      <span className="chevron" aria-hidden="true">
                        {open ? '⌃' : '⌄'}
                      </span>
                    </button>
                    <div className="chat-detail" id={detailId} hidden={!open}>
                      <p className="chat-bubble" lang={learningLang}>
                        {item.message}
                      </p>
                      <p className="meaning-bubble">{item.meaning}</p>
                      {item.note && (
                        <div className="chat-note">
                          <strong>{t('noteTitle')}</strong>
                          <p>{item.note}</p>
                        </div>
                      )}
                      <div className="row-actions">
                        <button className="text-button" onClick={() => recordForm.startEdit(item)}>
                          {t('edit')}
                        </button>
                        <button
                          className="text-button danger"
                          onClick={() => recordForm.removeItem(item)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
