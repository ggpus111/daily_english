import { useRef, useState } from 'react'
import DeleteButton from '../components/DeleteButton'
import ErrorReport from '../components/ErrorReport'
import ReminderSettings from '../components/ReminderSettings'
import Field from '../components/Field'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { MAX_FILE_BYTES, parseBackup, planImport } from '../lib/backup'
import { errorMessage } from '../lib/errors'
import { LANGUAGES, languageName } from '../lib/i18n'
import { shareJsonFile } from '../lib/native'
import { isNative } from '../lib/platform'
import { clearUserCache } from '../lib/records'
import { local } from '../lib/storage'
import { THEMES, getTheme, saveTheme } from '../lib/theme'
import { supabase } from '../lib/supabase'

const LAST_EXPORT_KEY = 'lastExportAt'

// 웹은 파일로 내려받고, 앱은 공유 창을 띄워 저장할 곳을 고르게 한다.
async function exportJson(records) {
  const fileName = `daily-english-${new Date().toISOString().slice(0, 10)}.json`
  const content = JSON.stringify(records, null, 2)
  if (isNative) {
    await shareJsonFile(fileName, content)
    return
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function Profile() {
  const {
    t,
    notify,
    user,
    nickname,
    records,
    importRecords,
    pendingCount,
    removeAll,
    nativeLang,
    setNativeLang,
    learningLang,
    setLearningLang,
    onLogin,
  } = useApp()

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      notify(t('deleteAccountError', { message: errorMessage(error, t) }))
      return
    }
    clearUserCache(user?.id, { includePending: true })
    await supabase.auth.signOut()
  }

  // 이 기기에 남긴 기록 사본은 지운다. 올리지 못한 변경은 다시 로그인하면 올라간다.
  async function logOut() {
    clearUserCache(user?.id)
    await supabase.auth.signOut()
  }

  const [theme, setTheme] = useState(getTheme)
  const fileRef = useRef(null)
  const [importPlan, setImportPlan] = useState(null)
  const [importing, setImporting] = useState(false)

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      notify(t('importError.tooBig'))
      return
    }
    try {
      const { records: incoming, invalid } = parseBackup(await file.text())
      setImportPlan({ ...planImport(records, incoming), invalid })
    } catch (error) {
      notify(t(`importError.${error.code ?? 'notBackup'}`))
    }
  }

  async function confirmImport() {
    setImporting(true)
    const result = await importRecords(importPlan.toAdd)
    setImporting(false)
    if (result.error) {
      notify(t('saveError', { message: errorMessage(result.error, t) }))
      return
    }
    notify(t(result.queued ? 'importDoneOffline' : 'importDone', { count: importPlan.added }))
    setImportPlan(null)
  }

  const [lastExport, setLastExport] = useState(() => local.get(LAST_EXPORT_KEY))
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'long',
  })

  async function exportRecords() {
    try {
      await exportJson(records)
    } catch (error) {
      // 공유 창을 그냥 닫아도 여기로 온다.
      if (!/cancel/i.test(error?.message ?? '')) notify(t('exportError'))
      return
    }
    const now = new Date().toISOString()
    local.set(LAST_EXPORT_KEY, now)
    setLastExport(now)
  }

  function deleteLocalRecords() {
    removeAll()
    notify(t('dataDeleted'))
  }

  return (
    <>
      <PageHead title={t('profile')} intro={t('profileIntro')} />

      <div className="two-column even">
        <section className="panel profile-card">
          <span className="avatar-large" aria-hidden="true">
            {nickname.slice(0, 1).toUpperCase()}
          </span>
          <h2>{t('account')}</h2>
          <dl>
            <dt>{t('nickname')}</dt>
            <dd>{nickname}</dd>
            <dt>{t('email')}</dt>
            <dd>{user ? user.email || t('noEmail') : t('localMode')}</dd>
          </dl>
          {supabase && !user && (
            <>
              <button className="primary-button" onClick={onLogin}>
                {t('guestLogin')}
              </button>
              <p className="tiny-note">{t('guestLoginNote')}</p>
            </>
          )}
          {supabase && user ? (
            <>
              <button className="soft-button" onClick={logOut}>
                {t('logout')}
              </button>
              {pendingCount > 0 && <p className="tiny-note">{t('pendingOnLogout', { count: pendingCount })}</p>}
            </>
          ) : (
            !supabase && <p className="tiny-note">{t('localModeNote')}</p>
          )}
        </section>

        <section className="panel stack-form">
          <h2>{t('settings')}</h2>
          <Field
            as="select"
            label={t('learningLanguage')}
            value={learningLang}
            onChange={(event) => setLearningLang(event.target.value)}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {languageName(language.code, nativeLang)}
              </option>
            ))}
          </Field>
          <Field
            as="select"
            label={t('nativeLanguage')}
            value={nativeLang}
            onChange={(event) => setNativeLang(event.target.value)}
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {languageName(language.code, nativeLang)}
              </option>
            ))}
          </Field>
          <p className="tiny-note">{t('languageNote')}</p>
          <Field
            as="select"
            label={t('themeLabel')}
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value)
              saveTheme(event.target.value)
            }}
          >
            {THEMES.map((option) => (
              <option key={option} value={option}>
                {t(`theme.${option}`)}
              </option>
            ))}
          </Field>
        </section>

        <section className="panel stack-form">
          <h2>{t('myData')}</h2>
          <p className="muted">{t('myDataBody')}</p>
          <p className="backup-status" role="status">
            {supabase && user && <span>{t('cloudSaved')} </span>}
            {lastExport
              ? t('lastExport', { date: dateFormat.format(new Date(lastExport)) })
              : t('neverExported')}
          </p>
          <div className="data-actions">
            <button className="soft-button" onClick={exportRecords}>
              {t('exportData')}
            </button>
            <button className="soft-button" onClick={() => fileRef.current?.click()}>
              {t('importData')}
            </button>
            {/* 안드로이드 파일 선택 창은 .json을 다른 형식으로 알아보기도 해서 앱에서는 거르지 않고, 읽을 때 검사한다. */}
            <input
              ref={fileRef}
              type="file"
              accept={isNative ? undefined : '.json,application/json'}
              hidden
              aria-label={t('importData')}
              onChange={chooseFile}
            />
            <DeleteButton
              className="danger-button"
              label={t(supabase && user ? 'deleteAccount' : 'deleteAllLocal')}
              confirmLabel={t('deleteDataConfirm')}
              onConfirm={supabase && user ? deleteAccount : deleteLocalRecords}
            />
          </div>
          {importPlan && (
            <div className="import-plan" role="region" aria-label={t('importTitle')}>
              <p className="import-title">{t('importTitle')}</p>
              {importPlan.added > 0 ? (
                <p>
                  {t('importCounts', {
                    word: importPlan.toAdd.word.length,
                    expression: importPlan.toAdd.expression.length,
                    chat: importPlan.toAdd.chat.length,
                    journal: importPlan.toAdd.journal.length,
                  })}
                </p>
              ) : (
                <p>{t('importNothing')}</p>
              )}
              {importPlan.duplicates > 0 && (
                <p className="tiny-note">{t('importDuplicates', { count: importPlan.duplicates })}</p>
              )}
              {importPlan.invalid > 0 && (
                <p className="tiny-note">{t('importInvalid', { count: importPlan.invalid })}</p>
              )}
              <div className="data-actions">
                {importPlan.added > 0 && (
                  <button className="primary-button" disabled={importing} onClick={confirmImport}>
                    {t('importConfirm', { count: importPlan.added })}
                  </button>
                )}
                <button className="soft-button" onClick={() => setImportPlan(null)}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
          <a className="inline-link" href="#pro">
            {t('proLink')}
          </a>
          <a className="inline-link" href="#privacy">
            {t('privacy')}
          </a>
        </section>

        <ReminderSettings />

        <ErrorReport />
      </div>
    </>
  )
}
