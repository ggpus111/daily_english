import { useMemo, useState } from 'react'
import Field from '../components/Field'
import GrammarPractice from '../components/GrammarPractice'
import PageHead from '../components/PageHead'
import SearchField from '../components/SearchField'
import { useApp } from '../context'
import { useRecordForm } from '../hooks/useRecordForm'
import { errorMessage } from '../lib/errors'
import { dueItems, schedule } from '../lib/review'
import { matchesQuery } from '../lib/text'

const EMPTY_FORM = { text: '', meaning: '', example: '', exampleNative: '' }
const REQUIRED = ['text', 'meaning']

/**
 * 문법 노트: 일기 교정에서 담은 문법(source: 'journal')과 직접 적은 문법을 모아 두고,
 * 번역·작문으로 연습한다. 복습 일정(상자)은 단어·표현과 같은 간격 반복을 쓴다.
 */
export default function Grammar() {
  const { t, notify, records, update, learningLang, go } = useApp()
  const items = records.grammar
  const recordForm = useRecordForm({ type: 'grammar', emptyForm: EMPTY_FORM, required: REQUIRED })
  const { form, errors, editingId, saving, formRef, listRef, setField } = recordForm
  const [query, setQuery] = useState('')
  const [practice, setPractice] = useState(null)

  const visible = useMemo(
    () => items.filter((item) => matchesQuery(query, [item.text, item.meaning, item.example, item.exampleNative])),
    [items, query],
  )
  const due = dueItems(items)

  function startAll() {
    if (items.length === 0) notify(t('grammarNeedNotes'))
    else setPractice(due.length ? due : items)
  }

  async function saveAnswer(item, correct) {
    const { error } = await update('grammar', item.id, schedule(item, correct))
    if (error) notify(t('saveError', { message: errorMessage(error, t) }))
  }

  return (
    <>
      <PageHead title={t('grammarTitle')} intro={t('grammarIntro')} />

      {practice ? (
        <GrammarPractice notes={practice} onClose={() => setPractice(null)} onAnswer={saveAnswer} />
      ) : (
        <div className="quiz-open">
          <button className="soft-button" onClick={startAll}>
            {t('grammarPracticeAll')}
          </button>
          <span className="muted">{t('reviewDueHere', { count: due.length })}</span>
          <button className="text-button" onClick={() => go('packs-grammar')}>
            {t('packsGrammarBrowse')}
          </button>
        </div>
      )}

      <div className="two-column">
        <form className="panel stack-form" ref={formRef} onSubmit={recordForm.submit} noValidate>
          <h2>{t(editingId ? 'grammarEdit' : 'grammarNew')}</h2>
          <Field
            label={t('grammarLabel')}
            name="text"
            required
            maxLength={150}
            autoComplete="off"
            placeholder={t('grammarLabelHint')}
            value={form.text}
            error={errors.text}
            onChange={(event) => setField('text', event.target.value)}
          />
          <Field
            label={t('grammarMeaning')}
            name="meaning"
            required
            maxLength={500}
            autoComplete="off"
            placeholder={t('grammarMeaningHint')}
            value={form.meaning}
            error={errors.meaning}
            onChange={(event) => setField('meaning', event.target.value)}
          />
          <Field
            label={t('example')}
            name="example"
            maxLength={500}
            lang={learningLang}
            value={form.example}
            onChange={(event) => setField('example', event.target.value)}
          />
          <Field
            label={t('grammarExampleNative')}
            name="exampleNative"
            maxLength={500}
            value={form.exampleNative}
            onChange={(event) => setField('exampleNative', event.target.value)}
          />
          <p className="tiny-note">{t('grammarFormNote')}</p>
          <button className="primary-button" disabled={saving}>
            {t(editingId ? 'editDone' : 'save')}
          </button>
          {editingId && (
            <button type="button" className="text-button" onClick={recordForm.reset}>
              {t('cancel')}
            </button>
          )}
        </form>

        <section className="panel" aria-labelledby="grammar-list">
          <div className="section-head">
            <h2 id="grammar-list" ref={listRef} tabIndex={-1}>
              {t('grammarList')}
            </h2>
            <span className="count">{t('count', { count: items.length })}</span>
          </div>
          <SearchField label={t('grammarSearch')} value={query} onChange={setQuery} />
          {visible.length === 0 ? (
            <p className="empty-state">{t(items.length === 0 ? 'grammarEmpty' : 'searchEmpty')}</p>
          ) : (
            <ul className="record-list">
              {visible.map((item) => (
                <li className="record-row" key={item.id}>
                  <div>
                    <strong lang={learningLang}>{item.text}</strong>
                    {item.source === 'journal' && <span className="missed-kind">{t('grammarFromJournal')}</span>}
                    {item.source === 'pack' && <span className="missed-kind">{t('grammarFromPack')}</span>}
                    <p>{item.meaning}</p>
                    {item.example && (
                      <p className="muted" lang={learningLang}>
                        {item.example}
                      </p>
                    )}
                    {item.exampleNative && <p className="muted">{item.exampleNative}</p>}
                  </div>
                  <div className="row-actions">
                    <button className="text-button" onClick={() => setPractice([item])}>
                      {t('grammarPracticeOne')}
                    </button>
                    <button className="text-button" onClick={() => recordForm.startEdit(item)}>
                      {t('edit')}
                    </button>
                    <button className="text-button danger" onClick={() => recordForm.removeItem(item)}>
                      {t('delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
