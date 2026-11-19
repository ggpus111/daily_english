import { useState } from 'react'
import { useApp } from '../context'
import { local } from '../lib/storage'
import { supabase } from '../lib/supabase'

const LAST_EXPORT_KEY = 'lastExportAt'
const DISMISSED_KEY = 'backupNudgeDismissedAt'
const MIN_RECORDS = 10
const QUIET_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

const within = (iso, days) => Boolean(iso) && Date.now() - Date.parse(iso) < days * DAY_MS

// 로그인하지 않아 기록이 이 기기에만 있을 때, 기록이 쌓이면 한 번씩 지키는 방법을 알려 준다.
// 리뷰 분석: 일기 앱 1~2점 리뷰의 29%가 데이터 유실. 2주 안에 백업했거나 "다음에"를 누르면 조용히 있는다.
export default function BackupNudge({ totalRecords }) {
  const { t, user, go, onLogin } = useApp()
  const [hidden, setHidden] = useState(
    () => within(local.get(LAST_EXPORT_KEY), QUIET_DAYS) || within(local.get(DISMISSED_KEY), QUIET_DAYS),
  )
  if (user || hidden || totalRecords < MIN_RECORDS) return null

  function later() {
    local.set(DISMISSED_KEY, new Date().toISOString())
    setHidden(true)
  }

  return (
    <section className="backup-nudge" aria-label={t('myData')}>
      <p>{t('backupNudge', { count: totalRecords })}</p>
      <div className="data-actions">
        {supabase ? (
          <button className="primary-button" onClick={onLogin}>
            {t('backupNudgeLogin')}
          </button>
        ) : null}
        <button className="soft-button" onClick={() => go('profile')}>
          {t('backupNudgeExport')}
        </button>
        <button className="text-button" onClick={later}>
          {t('backupNudgeLater')}
        </button>
      </div>
    </section>
  )
}
