import { useMemo, useState } from 'react'
import { hasPackData } from '../lib/packs'
import Field from '../components/Field'
import PackMeaningHint from '../components/PackMeaningHint'
import PageHead from '../components/PageHead'
import Quiz from '../components/Quiz'
import SearchField from '../components/SearchField'
import { useApp } from '../context'
import { useRecordForm } from '../hooks/useRecordForm'
import { errorMessage } from '../lib/errors'
import { dueItems, schedule } from '../lib/review'
import { matchesQuery } from '../lib/text'

const EMPTY_FORM = { text: '', meaning: '', example: '' }
const REQUIRED = ['text', 'meaning']

// 단어장과 표현 모음은 입력 항목이 같아서 문구만 바꿔 함께 쓴다.
const CONFIG = {
  word: {
    title: 'words',
    intro: 'wordIntro',
    formTitle: 'newWord',
    editTitle: 'editWord',
    textLabel: 'wordLabel',
    meaningHint: 'wordMeaningHint',
    listTitle: 'myWords',
    search: 'wordSearch',
    quiz: 'quiz',
    quizEmpty: 'quizNeedWords',
  },
  expression: {
    title: 'expressions',
    intro: 'expressionIntro',
    formTitle: 'newExpression',
    editTitle: 'editExpression',
    textLabel: 'expressionLabel',
    meaningHint: 'expressionMeaningHint',
    listTitle: 'myExpressions',
    search: 'expressionSearch',
    quiz: 'expressionQuiz',
    quizEmpty: 'quizNeedExpressions',
  },
}

export default function Entries({ type }) {
  const { t, notify, records, update, learningLang, go } = useApp()
  const config = CONFIG[type]
  const items = records[type]
  const recordForm = useRecordForm({ type, emptyForm: EMPTY_FORM, required: REQUIRED })
  const { form, errors, editingId, saving, formRef, listRef, setField } = recordForm
  const [query, setQuery] = useState('')
  const [quizOpen, setQuizOpen] = useState(false)

  const visible = useMemo(
    () => items.filter((item) => matchesQuery(query, [item.text, item.meaning, item.example])),
    [items, query],
  )

  const dueCount = dueItems(items).length

  function openQuiz() {
    if (items.length === 0) notify(t(config.quizEmpty))
    else setQuizOpen(true)
  }

  async function saveAnswer(item, correct) {
    const { error } = await update(type, item.id, schedule(item, correct))
    if (error) notify(t('saveError', { message: errorMessage(error, t) }))
  }

  return (
    <>
      <PageHead title={t(config.title)} intro={t(config.intro)} />

      {!quizOpen && (
        <div className="quiz-open">
          <button className="soft-button" onClick={openQuiz}>
            {t(config.quiz)}
          </button>
          <span className="muted">{t('reviewDueHere', { count: dueCount })}</span>
          {hasPackData(type === 'word' ? 'words' : 'expressions', learningLang) && (
            <button className="text-button" onClick={() => go(type === 'word' ? 'packs-words' : 'packs')}>
              {t(type === 'word' ? 'packsBrowseWords' : 'packsBrowse')}
            </button>
          )}
        </div>
      )}
      {quizOpen && (
        <Quiz items={items} onClose={() => setQuizOpen(false)} onAnswer={saveAnswer} />
      )}

      <div className="two-column">
        <form className="panel stack-form" ref={formRef} onSubmit={recordForm.submit} noValidate>
          <h2>{t(editingId ? config.editTitle : config.formTitle)}</h2>
          <Field
            label={t(config.textLabel)}
            name="text"
            required
            maxLength={200}
            autoComplete="off"
            value={form.text}
            error={errors.text}
            onChange={(event) => setField('text', event.target.value)}
          />
          <PackMeaningHint type={type} form={form} setField={setField} />
          <Field
            label={t('meaning')}
            name="meaning"
            required
            maxLength={500}
            autoComplete="off"
            placeholder={t(config.meaningHint)}
            value={form.meaning}
            error={errors.meaning}
            onChange={(event) => setField('meaning', event.target.value)}
          />
          <Field
            as="textarea"
            label={t('example')}
            name="example"
            rows={3}
            maxLength={1000}
            value={form.example}
            onChange={(event) => setField('example', event.target.value)}
          />
          <button className="primary-button" disabled={saving}>
            {t(editingId ? 'editDone' : 'save')}
          </button>
          {editingId && (
            <button type="button" className="text-button" onClick={recordForm.reset}>
              {t('cancel')}
            </button>
          )}
        </form>

        <section className="panel" aria-labelledby={`${type}-list`}>
          <div className="section-head">
            <h2 id={`${type}-list`} ref={listRef} tabIndex={-1}>
              {t(config.listTitle)}
            </h2>
            <span className="count">{t('count', { count: items.length })}</span>
          </div>
          <SearchField label={t(config.search)} value={query} onChange={setQuery} />
          {visible.length === 0 ? (
            <p className="empty-state">{t(items.length === 0 ? 'empty' : 'searchEmpty')}</p>
          ) : (
            <ul className="record-list">
              {visible.map((item) => (
                <li className="record-row" key={item.id}>
                  <div>
                    <strong lang={learningLang}>{item.text}</strong>
                    <p>{item.meaning}</p>
                    {item.example && (
                      <p className="muted" lang={learningLang}>
                        {item.example}
                      </p>
                    )}
                  </div>
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
