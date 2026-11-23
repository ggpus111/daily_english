import { useEffect, useState } from 'react'
import { useApp } from '../../context'
import { checkAdmin } from '../../lib/reports'
import { supabase } from '../../lib/supabase'
import ErrorReport from '../ErrorReport'
import ReportForm from '../ReportForm'

const VERSION = typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__

/** 설정의 "도움말과 정보": 의견 보내기, 앱 오류 기록, Pro 안내, 앱 버전. 관리자 계정이면 관리자 페이지 링크. */
export default function HelpSection() {
  const { t, user } = useApp()
  // 권한은 서버가 다시 확인한다. 여기서는 링크를 보일지만 정한다.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (supabase && user) checkAdmin().then(setIsAdmin)
  }, [user])

  return (
    <>
      <ReportForm />
      <ErrorReport />
      <section className="s-section" aria-labelledby="settings-about">
        <h2 id="settings-about">{t('settingsAbout')}</h2>
        <div className="s-list">
          <div className="s-row s-row-static">
            <span className="s-row-label">{t('appVersion')}</span>
            <span className="s-row-value">{VERSION}</span>
          </div>
          <a className="s-row" href="#pro">
            <span className="s-row-label">{t('proLink')}</span>
            <span className="s-row-chevron" aria-hidden="true" />
          </a>
          <a className="s-row" href="#privacy">
            <span className="s-row-label">{t('privacy')}</span>
            <span className="s-row-chevron" aria-hidden="true" />
          </a>
          {isAdmin && (
            <a className="s-row admin-link" href="#admin">
              <span className="s-row-label">{t('adminLink')}</span>
              <span className="s-row-chevron" aria-hidden="true" />
            </a>
          )}
        </div>
      </section>
    </>
  )
}
