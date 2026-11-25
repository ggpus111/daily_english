import { useRef, useState } from 'react'
import Feedback from '../components/Feedback'
import JournalCalendar from '../components/JournalCalendar'
import Field from '../components/Field'
import MoodPicker from '../components/MoodPicker'
import { TodayMission, UsageLine } from '../components/Usage'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { useRecordForm } from '../hooks/useRecordForm'
import { dayKey } from '../lib/activity'
import { AI_DAILY_LIMIT, AI_PRO_DAILY_LIMIT, aiConfigured, giveAiConsent, hasAiConsent, requestCorrection } from '../lib/aiCorrection'
import { buildCorrectionPrompt, parseFeedback, recentPracticeNotes, recentWordTexts } from '../lib/correction'
import { languageName } from '../lib/i18n'
import { moodMeaning, moodOf, moodWord } from '../lib/moods'
import { addDraft, draftTitle, hasDraftText, loadDrafts, putBackDraft, removeDraft } from '../lib/journalDrafts'
import { JOURNAL_DRAFT_KEY } from '../lib/records'

const EMPTY_FORM = {
  mood: '',
  native: '',
  translation: '',
  aiFeedback: '',
  memo: '',
}
const REQUIRED = ['native']
const MAX_TEXT_LENGTH = 4000

export default function Journal() {
  const { t, notify, records, nativeLang, learningLang, user, onLogin, isPro } = useApp()
  const items = records.journal
  const recordForm = useRecordForm({
    type: 'journal',
    emptyForm: EMPTY_FORM,
    required: REQUIRED,
    draftKey: JOURNAL_DRAFT_KEY,
  })
  const { form, errors, editingId, saving, formRef, listRef, setField } = recordForm
  const [openId, setOpenId] = useState(null)
  // 달력에서 고른 날짜("2026-11-23"). 고르면 그날 일기만 보여 준다.
  const [day, setDay] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const aiBusyRef = useRef(false)
  const [askingConsent, setAskingConsent] = useState(false)
  const [askingRedo, setAskingRedo] = useState(false)
  const [aiRemaining, setAiRemaining] = useState(null)
  // "임시저장" 버튼으로 따로 치워 둔 일기들(이 기기에만 남는다).
  const [drafts, setDrafts] = useState(loadDrafts)
  const canAskAi = aiConfigured() && Boolean(user)
  const preview = parseFeedback(form.aiFeedback)

  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'long',
  })
  const dateOnly = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' })
  const draftTime = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const shown = day ? items.filter((item) => dayKey(item.createdAt) === day) : items

  function makePrompt() {
    return buildCorrectionPrompt({
      uiLang: nativeLang,
      learning: languageName(learningLang, nativeLang),
      explain: languageName(nativeLang, nativeLang),
      native: form.native.trim(),
      translation: form.translation.trim(),
      practiceNotes: recentPracticeNotes(items, editingId),
      recentWords: recentWordTexts(records.word),
    })
  }

  // 지금 쓰던 일기를 임시저장함에 넣고 폼을 비운다.
  function saveDraft() {
    if (!hasDraftText(form)) {
      notify(t('draftEmpty'))
      return
    }
    setDrafts(addDraft(form))
    recordForm.reset()
    notify(t('draftSaved'))
  }

  // 임시저장함에서 꺼내 이어 쓴다. 지금 쓰던 글이 있으면 잃지 않게 먼저 임시저장함에 넣어 둔다.
  function continueDraft(draft) {
    if (editingId) {
      notify(t('draftFinishEdit'))
      return
    }
    let next = removeDraft(draft.id)
    if (hasDraftText(form)) next = addDraft(form) ?? next
    setDrafts(next)
    recordForm.loadForm(draft.form)
    formRef.current?.scrollIntoView({ block: 'start' })
    notify(t('draftContinued'))
  }

  function deleteDraft(draft) {
    setDrafts(removeDraft(draft.id))
    notify(t('draftDeleted'), { label: t('undo'), onClick: () => setDrafts(putBackDraft(draft)) })
  }

  // 교정은 앱 안에서만 받는다(다른 AI로 복사해 나가지 않음). 처음에는 어디로 보내지는지 알리고 동의를 받는다.
  // 받은 교정은 아래에 나눠 보여 주고, 일기를 저장하면 함께 남는다. 다시 누르면 고친 번역으로 다시 받는다.
  async function askAi({ consented = false, redo = false } = {}) {
    // 빠르게 두 번 눌러도 요청은 한 번만 나간다(화면 상태는 늦게 바뀌어서 ref로 바로 막는다).
    if (aiBusyRef.current) return
    if (!form.native.trim() || !form.translation.trim()) {
      notify(t('correctionNeedText'))
      return
    }
    // 이미 교정을 받은 일기면, 하루 횟수를 또 쓰기 전에 다시 받을지 먼저 묻는다.
    if (!redo && form.aiFeedback.trim()) {
      setAskingRedo(true)
      return
    }
    setAskingRedo(false)
    if (!consented && !hasAiConsent()) {
      setAskingConsent(true)
      return
    }
    setAskingConsent(false)
    aiBusyRef.current = true
    setAiBusy(true)
    let result
    try {
      result = await requestCorrection(makePrompt())
    } finally {
      aiBusyRef.current = false
      setAiBusy(false)
    }
    if (result.error) {
      notify(t(`aiError.${result.error}`) + (result.detail ? ` (${result.detail})` : ''))
      return
    }
    setField('aiFeedback', result.feedback)
    setAiRemaining(result.remaining)
    notify(t('aiDone'))
  }

  return (
    <>
      <PageHead title={t('journal')} intro={t('diaryIntro')} />

      <div className="two-column">
        <form className="panel stack-form" ref={formRef} onSubmit={recordForm.submit} noValidate>
          <h2>{t(editingId ? 'editJournal' : 'newJournal')}</h2>
          <MoodPicker value={form.mood} onChange={(mood) => setField('mood', mood)} />
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
            label={t('diaryTranslation', {
              lang: languageName(learningLang, nativeLang),
            })}
            name="translation"
            rows={5}
            maxLength={MAX_TEXT_LENGTH}
            lang={learningLang}
            placeholder={t('diaryTranslationHint')}
            value={form.translation}
            onChange={(event) => setField('translation', event.target.value)}
          />
          {
            <div className="usage-box">
              <TodayMission sentence={form.translation} mood={form.mood} />
              <UsageLine sentence={form.translation} live />
            </div>
          }
          <div className="correction-action">
            {canAskAi ? (
              <>
                <button
                  type="button"
                  className="ai-button"
                  onClick={() => askAi()}
                  disabled={aiBusy}
                  aria-busy={aiBusy}
                >
                  {t(aiBusy ? 'aiWorking' : 'aiAsk')}
                </button>
                <p className="tiny-note">
                  {aiRemaining === null ? t('aiAskHelp', { limit: isPro ? AI_PRO_DAILY_LIMIT : AI_DAILY_LIMIT }) : t('aiRemaining', { count: aiRemaining })}
                </p>
              </>
            ) : aiConfigured() ? (
              <p className="tiny-note">
                {t('aiNeedLogin')}{' '}
                <button type="button" className="text-button" onClick={onLogin}>
                  {t('aiLogin')}
                </button>
              </p>
            ) : (
              <p className="tiny-note">{t('aiUnavailable')}</p>
            )}
            {askingConsent && (
              <section className="ai-consent" aria-labelledby="ai-consent-title">
                <h3 id="ai-consent-title">{t('aiConsentTitle')}</h3>
                <p>{t('aiConsentBody')}</p>
                <div className="data-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      giveAiConsent()
                      // 다시 받기를 이미 골랐거나 처음 받는 교정이라, 여기서는 다시 묻지 않는다.
                      askAi({ consented: true, redo: true })
                    }}
                  >
                    {t('aiConsentYes')}
                  </button>
                  <button type="button" className="text-button" onClick={() => setAskingConsent(false)}>
                    {t('aiConsentNo')}
                  </button>
                </div>
              </section>
            )}
            {askingRedo && (
              <section className="ai-consent" aria-labelledby="ai-redo-title">
                <h3 id="ai-redo-title">{t('aiRedoTitle')}</h3>
                <p>{t('aiRedoBody')}</p>
                <div className="data-actions">
                  <button type="button" className="primary-button" onClick={() => askAi({ redo: true })}>
                    {t('aiRedoYes')}
                  </button>
                  <button type="button" className="text-button" onClick={() => setAskingRedo(false)}>
                    {t('aiRedoNo')}
                  </button>
                </div>
              </section>
            )}
          </div>
          {preview && (
            <div className="correction-panel" aria-live="polite">
              <p className="correction-label">{t('correctionTitle')}</p>
              <Feedback text={form.aiFeedback} learningLang={learningLang} t={t} canSave />
            </div>
          )}
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
          {!editingId && (
            <button type="button" className="soft-button" onClick={saveDraft}>
              {t('draftSave')}
            </button>
          )}
          {editingId && (
            <button type="button" className="text-button" onClick={recordForm.reset}>
              {t('cancel')}
            </button>
          )}
          <p className="tiny-note">{t('draftAutoNote')}</p>
          <p className="tiny-note">{t('diaryNotice')}</p>
        </form>

        <div className="stack-column">
        {drafts.length > 0 && (
          <section className="panel" aria-labelledby="journal-drafts">
            <div className="section-head">
              <h2 id="journal-drafts">{t('draftListTitle')}</h2>
              <span className="count">{t('count', { count: drafts.length })}</span>
            </div>
            <ul className="record-list">
              {drafts.map((draft) => (
                <li className="journal-entry" key={draft.id}>
                  <div className="journal-meta">
                    <small className="muted">{draftTime.format(new Date(draft.savedAt))}</small>
                  </div>
                  <p className="clamped">{draftTitle(draft.form) || t('draftUntitled')}</p>
                  <div className="row-actions">
                    <button className="text-button" onClick={() => continueDraft(draft)}>
                      {t('draftContinue')}
                    </button>
                    <button className="text-button danger" onClick={() => deleteDraft(draft)}>
                      {t('delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel" aria-labelledby="journal-list">
          <div className="section-head">
            <h2 id="journal-list" ref={listRef} tabIndex={-1}>
              {t('diaryList')}
            </h2>
            <span className="count">{t('count', { count: items.length })}</span>
          </div>
          {items.length > 0 && <JournalCalendar items={items} selected={day} onSelect={setDay} />}
          {day && (
            <p className="calendar-filter" role="status">
              <span>
                {t('calendarSelected', { date: dateOnly.format(new Date(`${day}T00:00:00`)), count: shown.length })}
              </span>
              <button className="text-button" onClick={() => setDay(null)}>
                {t('calendarShowAll')}
              </button>
            </p>
          )}
          {items.length === 0 ? (
            <p className="empty-state">{t('empty')}</p>
          ) : (
            <ul className="record-list">
              {shown.map((item) => {
                const open = openId === item.id
                const detailId = `journal-detail-${item.id}`
                return (
                  <li className="journal-entry" key={item.id}>
                    <div className="journal-meta">
                      <small className="muted">{dateFormat.format(new Date(item.createdAt))}</small>
                      {moodOf(item.mood) && (
                        <span className="mood-tag">
                          <span lang={learningLang}>{moodWord(moodOf(item.mood), learningLang)}</span>
                          <span> · {moodMeaning(moodOf(item.mood), learningLang)}</span>
                        </span>
                      )}
                    </div>
                    <p className={open ? '' : 'clamped'}>{item.native}</p>
                    {item.translation && <UsageLine sentence={item.translation} />}
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
                      <button className="text-button danger" onClick={() => recordForm.removeItem(item)}>
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
      </div>
    </>
  )
}
