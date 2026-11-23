import { useApp } from '../../context'
import { todayStatus } from '../../lib/couple'

/**
 * 상대(연인·친구) 동그라미 줄. 누르면 그 상대와 주고받는 화면이 열리고, 다시 누르면 오늘 모아보기로 돌아온다.
 * 오늘 상대는 보냈는데 나는 아직 안 보냈으면 작은 점으로 알려 준다. 맨 끝은 상대 추가.
 */
export default function PairAvatars({ pairs, userId, selectedId, onSelect }) {
  const { t } = useApp()
  const toggle = (id) => onSelect(selectedId === id ? null : id)

  return (
    <nav className="pair-avatars" aria-label={t('pairListLabel')}>
      <ul>
        {pairs.map((pair) => {
          const name = pair.partner?.nickname ?? t('pairWaiting')
          const status = pair.partner ? todayStatus(pair, userId) : null
          const waitingForMe = status?.received && !status.sent
          return (
            <li key={pair.id}>
              <button className="pair-avatar" aria-pressed={selectedId === pair.id} onClick={() => toggle(pair.id)}>
                <span className={`pair-circle ${pair.kind}${pair.partner ? '' : ' waiting'}`} aria-hidden="true">
                  {pair.partner ? name.slice(0, 1).toUpperCase() : ''}
                  {waitingForMe && <span className="pair-dot" />}
                </span>
                <span className="pair-name">{name}</span>{' '}
                <span className="pair-kind">{t(`pairKind.${pair.kind}`)}</span>
                {waitingForMe && <span className="sr-only"> · {t('pairNewToday')}</span>}
              </button>
            </li>
          )
        })}
        <li>
          <button className="pair-avatar" aria-pressed={selectedId === 'add'} onClick={() => toggle('add')}>
            <span className="pair-circle add" aria-hidden="true">
              +
            </span>
            <span className="pair-name">{t('pairAdd')}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
