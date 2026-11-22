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
      <section className="panel settings-group" aria-labelledby="settings-about">
        <h2 id="settings-about">{t('settingsAbout')}</h2>
        <dl className="about-list">
          <dt>{t('appVersion')}</dt>
          <dd>{VERSION}</dd>
        </dl>
        <div className="settings-links">
          <a className="inline-link" href="#pro">
            {t('proLink')}
          </a>
          <a className="inline-link" href="#privacy">
            {t('privacy')}
          </a>
          {isAdmin && (
            <a className="inline-link admin-link" href="#admin">
              {t('adminLink')}
            </a>
          )}
        </div>
      </section>
    </>
  )
}
