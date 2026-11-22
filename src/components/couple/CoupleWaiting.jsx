import { useApp } from '../../context'

/** 초대 번호를 만들고 연인이 들어오기를 기다리는 화면. */
export default function CoupleWaiting({ code, onRefresh }) {
  const { t, notify } = useApp()

  const copy = () =>
    navigator.clipboard
      .writeText(code)
      .then(() => notify(t('coupleCopied')))
      .catch(() => notify(t('coupleCopyFail')))

  return (
    <section className="paper-card couple-card" aria-labelledby="couple-wait">
      <h2 id="couple-wait">{t('coupleWaitTitle')}</h2>
      <p className="muted">{t('coupleWaitHelp')}</p>
      <p className="couple-code" aria-label={t('coupleCode')}>
        {code}
      </p>
      <div className="button-row">
        <button className="primary-button" onClick={copy}>
          {t('coupleCopy')}
        </button>
        <button className="soft-button" onClick={onRefresh}>
          {t('coupleRefresh')}
        </button>
      </div>
    </section>
  )
}
