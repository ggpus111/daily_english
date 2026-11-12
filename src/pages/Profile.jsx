import { useState } from 'react'
import DeleteButton from '../components/DeleteButton'
import Field from '../components/Field'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { LANGUAGES, languageName } from '../lib/i18n'
import { local } from '../lib/storage'
import { supabase } from '../lib/supabase'

const LAST_EXPORT_KEY = 'lastExportAt'

function downloadJson(records) {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `daily-english-${new Date().toISOString().slice(0, 10)}.json`
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
    removeAll,
    nativeLang,
    setNativeLang,
    learningLang,
    setLearningLang,
  } = useApp()

  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) notify(t('deleteAccountError', { message: error.message }))
    else await supabase.auth.signOut()
  }

  const [lastExport, setLastExport] = useState(() => local.get(LAST_EXPORT_KEY))
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'long',
  })

  function exportRecords() {
    downloadJson(records)
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
          {supabase ? (
            <button className="soft-button" onClick={() => supabase.auth.signOut()}>
              {t('logout')}
            </button>
          ) : (
            <p className="tiny-note">{t('localModeNote')}</p>
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
        </section>

        <section className="panel stack-form">
          <h2>{t('myData')}</h2>
          <p className="muted">{t('myDataBody')}</p>
          <p className="backup-status" role="status">
            {supabase && <span>{t('cloudSaved')} </span>}
            {lastExport
              ? t('lastExport', { date: dateFormat.format(new Date(lastExport)) })
              : t('neverExported')}
          </p>
          <div className="data-actions">
            <button className="soft-button" onClick={exportRecords}>
              {t('exportData')}
            </button>
            <DeleteButton
              className="danger-button"
              label={t(supabase ? 'deleteAccount' : 'deleteAllLocal')}
              confirmLabel={t('deleteDataConfirm')}
              onConfirm={supabase ? deleteAccount : deleteLocalRecords}
            />
          </div>
          <a className="inline-link" href="#privacy">
            {t('privacy')}
          </a>
        </section>
      </div>
    </>
  )
}
