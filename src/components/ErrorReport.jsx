import { useState } from 'react'
import { useApp } from '../context'
import { clearErrorLog, formatErrorLog, readErrorLog } from '../lib/errorLog'

// 프로필의 "앱 오류 기록": 이 기기에 남은 오류를 보고, 문의할 때 복사해 보낼 수 있다.
export default function ErrorReport() {
  const { t, notify, nativeLang } = useApp()
  const [list, setList] = useState(readErrorLog)
  const dateFormat = new Intl.DateTimeFormat(nativeLang === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatErrorLog(list))
      notify(t('errorLogCopied'))
    } catch {
      notify(t('errorLogCopyFailed'))
    }
  }

  function clear() {
    clearErrorLog()
    setList([])
    notify(t('errorLogCleared'))
  }

  return (
    <section className="panel stack-form" aria-labelledby="error-log-title">
      <div className="section-head">
        <h2 id="error-log-title">{t('errorLogTitle')}</h2>
        <span className="count">{t('count', { count: list.length })}</span>
      </div>
      <p className="muted">{t('errorLogBody')}</p>
      {list.length === 0 ? (
        <p className="tiny-note">{t('errorLogEmpty')}</p>
      ) : (
        <>
          <ul className="error-log">
            {list.slice(0, 3).map((item) => (
              <li key={`${item.at}-${item.message}`}>
                <small className="muted">
                  {dateFormat.format(new Date(item.at))} · #{item.page}
                  {item.count > 1 && ` · ${t('errorLogTimes', { count: item.count })}`}
                </small>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
          <div className="data-actions">
            <button className="soft-button" onClick={copy}>
              {t('errorLogCopy')}
            </button>
            <button className="text-button" onClick={clear}>
              {t('errorLogClear')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
