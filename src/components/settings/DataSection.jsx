import { useRef, useState } from 'react'
import { useApp } from '../../context'
import { useAccountActions } from '../../hooks/useAccountActions'
import { AI_CONSENT_KEY } from '../../lib/aiCorrection'
import { LAST_EXPORT_KEY, MAX_FILE_BYTES, parseBackup, planImport } from '../../lib/backup'
import { errorMessage } from '../../lib/errors'
import { shareJsonFile } from '../../lib/native'
import { isNative } from '../../lib/platform'
import { local } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import DeleteButton from '../DeleteButton'

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

/** 설정의 "개인정보와 데이터": 내려받기·가져오기, AI 동의 되돌리기, 처리방침, 삭제. */
export default function DataSection() {
  const { t, notify, user, records, importRecords, removeAll, nativeLang } = useApp()
  const { deleteAccount } = useAccountActions()
  const fileRef = useRef(null)
  const [importPlan, setImportPlan] = useState(null)
  const [importing, setImporting] = useState(false)
  const [lastExport, setLastExport] = useState(() => local.get(LAST_EXPORT_KEY))
  const [aiConsent, setAiConsent] = useState(() => local.get(AI_CONSENT_KEY) === '1')
  const signedIn = Boolean(supabase && user)
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'long' })

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

  function withdrawAiConsent() {
    local.remove(AI_CONSENT_KEY)
    setAiConsent(false)
    notify(t('aiConsentWithdrawn'))
  }

  function deleteLocalRecords() {
    removeAll()
    notify(t('dataDeleted'))
  }

  return (
    <section className="s-section" aria-labelledby="settings-data">
      <h2 id="settings-data">{t('settingsData')}</h2>
      <p className="muted">{t('myDataBody')}</p>
      <p className="backup-status" role="status">
        {signedIn && <span>{t('cloudSaved')} </span>}
        {lastExport ? t('lastExport', { date: dateFormat.format(new Date(lastExport)) }) : t('neverExported')}
      </p>
      <div className="s-list">
        <button className="s-row" onClick={exportRecords}>
          <span className="s-row-label">{t('exportData')}</span>
          <span className="s-row-chevron" aria-hidden="true" />
        </button>
        <button className="s-row" onClick={() => fileRef.current?.click()}>
          <span className="s-row-label">{t('importData')}</span>
          <span className="s-row-chevron" aria-hidden="true" />
        </button>
        {aiConsent && (
          <button className="s-row" onClick={withdrawAiConsent}>
            <span className="s-row-label">{t('aiConsentWithdraw')}</span>
            <span className="s-row-chevron" aria-hidden="true" />
          </button>
        )}
        <a className="s-row" href="#privacy">
          <span className="s-row-label">{t('privacy')}</span>
          <span className="s-row-chevron" aria-hidden="true" />
        </a>
      </div>
      {/* 안드로이드 파일 선택 창은 .json을 다른 형식으로 알아보기도 해서 앱에서는 거르지 않고, 읽을 때 검사한다. */}
      <input
        ref={fileRef}
        type="file"
        accept={isNative ? undefined : '.json,application/json'}
        hidden
        aria-label={t('importData')}
        onChange={chooseFile}
      />

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
                grammar: importPlan.toAdd.grammar.length,
              })}
            </p>
          ) : (
            <p>{t('importNothing')}</p>
          )}
          {importPlan.duplicates > 0 && (
            <p className="tiny-note">{t('importDuplicates', { count: importPlan.duplicates })}</p>
          )}
          {importPlan.invalid > 0 && <p className="tiny-note">{t('importInvalid', { count: importPlan.invalid })}</p>}
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

      <div className="danger-zone">
        <DeleteButton
          className="danger-button"
          label={t(signedIn ? 'deleteAccount' : 'deleteAllLocal')}
          confirmLabel={t('deleteDataConfirm')}
          onConfirm={signedIn ? deleteAccount : deleteLocalRecords}
        />
      </div>
    </section>
  )
}
