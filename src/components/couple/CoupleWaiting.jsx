import { useApp } from '../../context'
import { shareInvite } from '../../lib/invite'

/** 초대 링크를 보낸다(공유 창, 안 되면 링크 복사). 오늘 모아보기의 기다리는 짝 목록도 함께 쓴다. */
export async function sendInvite({ code, t, notify, nickname }) {
  const result = await shareInvite(code, {
    title: t('inviteShareTitle'),
    text: t('inviteShareText', { name: nickname || t('inviteSomeone'), code }),
  })
  if (result === 'copied') notify(t('inviteCopied'))
  if (result === 'failed') notify(t('inviteShareFail'))
}

/** 초대 번호를 만들고 상대가 들어오기를 기다리는 화면. */
export default function CoupleWaiting({ code, onRefresh }) {
  const { t, notify, nickname } = useApp()
  const share = () => sendInvite({ code, t, notify, nickname })

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
        <button className="primary-button" onClick={share}>
          {t('inviteShare')}
        </button>
        <button className="soft-button" onClick={copy}>
          {t('coupleCopy')}
        </button>
        <button className="soft-button" onClick={onRefresh}>
          {t('coupleRefresh')}
        </button>
      </div>
    </section>
  )
}
