import { useState } from 'react'
import Feedback from '../components/Feedback'
import Field from '../components/Field'
import MoodPicker from '../components/MoodPicker'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { useRecordForm } from '../hooks/useRecordForm'
import { buildCorrectionPrompt, recentPracticeNotes, recentWordTexts } from '../lib/correction'
import { languageName } from '../lib/i18n'
import { moodOf } from '../lib/moods'
import { openExternal } from '../lib/native'
import { isNative } from '../lib/platform'
import { JOURNAL_DRAFT_KEY } from '../lib/records'

const EMPTY_FORM = { mood: '', native: '', translation: '', aiFeedback: '', memo: '' }
const REQUIRED = ['native']
const MAX_TEXT_LENGTH = 4000
const AI_CHATS = [
  { label: 'openClaude', href: 'https://claude.ai/new' },
  { label: 'openChatGpt', href: 'https://chatgpt.com/' },
]

export default function Journal() {
  const { t, notify, records, nativeLang, learningLang } = useApp()
  const items = records.journal
  const recordForm = useRecordForm({
    type: 'journal',
    emptyForm: EMPTY_FORM,
    required: REQUIRED,
    draftKey: JOURNAL_DRAFT_KEY,
  })
  const { form, errors, editingId, saving, formRef, listRef, setField } = recordForm
  const [manualPrompt, setManualPrompt] = useState('')
  const [openId, setOpenId] = useState(null)

  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'long',
  })

  async function copyPrompt() {
    if (!form.native.trim() || !form.translation.trim()) {
      notify(t('correctionNeedText'))
      return
    }

    const prompt = buildCorrectionPrompt({
      uiLang: nativeLang,
      learning: languageName(learningLang, nativeLang),
      explain: languageName(nativeLang, nativeLang),
      native: form.native.trim(),
      translation: form.translation.trim(),
      practiceNotes: recentPracticeNotes(items, editingId),
      recentWords: recentWordTexts(records.word),
    })
    try {
      await navigator.clipboard.writeText(prompt)
      setManualPrompt('')
      notify(t('promptCopied'))
    } catch {
      setManualPrompt(prompt)
    }
  }

  return (
    <>
      <PageHead title={t('journal')} intro={t('diaryIntro')} />

      <div className="two-column">
        <form className="panel stack-form" ref={formRef} onSubmit={recordForm.submit} noValidate>
          <h2>{t(editingId ? 'editJournal' : 'newJournal')}</h2>
          {learningLang === 'en' && <MoodPicker value={form.mood} onChange={(mood) => setField('mood', mood)} />}
          <Field
            as="textarea"
            label={t('diaryNative')}
            name="native"
            required
            rows={5}
            maxLength={MAX_TEXT_LENGTH}
            placeholder={t('diaryNativeHint')}
            value={form.native}
            error={errors.native}
            onChange={(event) => setField('native', event.target.value)}
          />
          <Field
            as="textarea"
            label={t('diaryTranslation', { lang: languageName(learningLang, nativeLang) })}
            name="translation"
            rows={5}
            maxLength={MAX_TEXT_LENGTH}
            lang={learningLang}
            placeholder={t('diaryTranslationHint')}
            value={form.translation}
            onChange={(event) => setField('translation', event.target.value)}
          />
          <div className="correction-action">
            <button type="button" className="soft-button" onClick={copyPrompt}>
              {t('copyPrompt')}
            </button>
            <p className="tiny-note">{t('copyPromptHelp')}</p>
            <a className="inline-link pro-teaser" href="#pro">
              {t('proJournalTeaser')}
            </a>
            <div className="external-links">
              {AI_CHATS.map((chat) => (
                <a
                  key={chat.href}
                  className="inline-link"
                  href={chat.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (!isNative) return
                    event.preventDefault()
                    openExternal(chat.href)
                  }}
                >
                  {t(chat.label)}
                </a>
              ))}
            </div>
          </div>
          {manualPrompt && (
            <Field
              as="textarea"
              label={t('copyManual')}
              rows={6}
              readOnly
              value={manualPrompt}
              onFocus={(event) => event.target.select()}
            />
          )}
          <Field
            as="textarea"
            label={t('aiFeedback')}
            name="aiFeedback"
            rows={5}
            maxLength={8000}
            placeholder={t('aiFeedbackHint')}
            value={form.aiFeedback}
            onChange={(event) => setField('aiFeedback', event.target.value)}
          />
          <Field
            as="textarea"
            label={t('diaryMemo')}
            name="memo"
            rows={3}
            maxLength={2000}
            placeholder={t('diaryMemoHint')}
            value={form.memo}
            onChange={(event) => setField('memo', event.target.value)}
          />
          <button className="primary-button" disabled={saving}>
            {t(editingId ? 'editDone' : 'diarySave')}
          </button>
          {editingId && (
            <button type="button" className="text-button" onClick={recordForm.reset}>
              {t('cancel')}
            </button>
          )}
          <p className="tiny-note">{t('diaryNotice')}</p>
        </form>

        <section className="panel" aria-labelledby="journal-list">
          <div className="section-head">
            <h2 id="journal-list" ref={listRef} tabIndex={-1}>
              {t('diaryList')}
            </h2>
            <span className="count">{t('count', { count: items.length })}</span>
          </div>
          {items.length === 0 ? (
            <p className="empty-state">{t('empty')}</p>
          ) : (
            <ul className="record-list">
              {items.map((item) => {
                const open = openId === item.id
                const detailId = `journal-detail-${item.id}`
                return (
                  <li className="journal-entry" key={item.id}>
                    <div className="journal-meta">
                      <small className="muted">{dateFormat.format(new Date(item.createdAt))}</small>
                      {moodOf(item.mood) && (
                        <span className="mood-tag">
                          <span lang="en">{item.mood}</span>
                          {nativeLang === 'ko' && <span> · {moodOf(item.mood).ko}</span>}
                        </span>
                      )}
                    </div>
                    <p className={open ? '' : 'clamped'}>{item.native}</p>
                    <div id={detailId} className="journal-detail" hidden={!open}>
                      {item.translation && (
                        <p className="journal-translation" lang={learningLang}>
                          {item.translation}
                        </p>
                      )}
                      {item.aiFeedback && (
                        <div className="correction-panel">
                          <p className="correction-label">{t('correctionTitle')}</p>
                          <Feedback text={item.aiFeedback} learningLang={learningLang} t={t} canSave />
                        </div>
                      )}
                      {item.memo && <p className="chat-note">{item.memo}</p>}
                    </div>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        aria-expanded={open}
                        aria-controls={detailId}
                        onClick={() => setOpenId(open ? null : item.id)}
                      >
                        {t(open ? 'collapse' : 'expand')}
                      </button>
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
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
