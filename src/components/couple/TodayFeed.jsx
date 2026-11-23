import { useMemo, useState } from 'react'
import { useApp } from '../../context'
import { SENTENCE_MAX, reactionsBySentence, todayStatus } from '../../lib/couple'
import { dayKey } from '../../lib/activity'
import { errorMessage } from '../../lib/errors'
import Field from '../Field'
import { ReactionBar } from './CoupleToday'

const FILTERS = ['all', 'partner', 'friend']

/**
 * 오늘 모아보기: 모든 상대(또는 연인·친구만)에게서 오늘 받은 문장을 한곳에 보여 주고,
 * 아직 안 보낸 상대에게 내 오늘 문장을 한 번에 보낸다. 기다리는 초대 번호도 여기서 다시 볼 수 있다.
 */
export default function TodayFeed({ pairs, userId, busy, onOpen, onReact, onSendAll, onCopy, onRefresh }) {
  const { t, add, notify } = useApp()
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState('')
  const today = dayKey(new Date())

  const kinds = new Set(pairs.map((pair) => pair.kind))
  const shown = filter === 'all' ? pairs : pairs.filter((pair) => pair.kind === filter)
  const joined = shown.filter((pair) => pair.partner)
  const waiting = shown.filter((pair) => !pair.partner)
  const received = joined.flatMap((pair) =>
    pair.sentences.filter((row) => row.day === today && row.user_id !== userId).map((row) => ({ pair, row })),
  )
  const pending = joined.filter((pair) => !todayStatus(pair, userId).sent)
  const reactionMap = useMemo(
    () =>
      reactionsBySentence(
        pairs.flatMap((pair) => pair.reactions),
        userId,
      ),
    [pairs, userId],
  )

  async function save({ pair, row }) {
    const result = await add('expression', {
      text: row.body,
      meaning: t('coupleSavedFrom', { name: pair.partner.nickname }),
      example: '',
    })
    notify(result.error ? t('coupleError', { message: errorMessage(result.error, t) }) : t('coupleSaved'))
  }

  async function sendAll() {
    const ok = await onSendAll(
      draft,
      pending.map((pair) => pair.id),
    )
    if (ok) setDraft('')
  }

  return (
    <>
      {kinds.size > 1 && (
        <div className="filter-chips" role="group" aria-label={t('pairFilterLabel')}>
          {FILTERS.map((value) => (
            <button
              key={value}
              className="reaction-chip"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {t(value === 'all' ? 'pairFilterAll' : `pairKind.${value}`)}
            </button>
          ))}
        </div>
      )}

      <section className="paper-card couple-card" aria-labelledby="feed-received">
        <h2 id="feed-received">{t('feedReceived')}</h2>
        {received.length === 0 ? (
          <p className="muted">{t(joined.length ? 'feedEmpty' : 'feedNoPartner')}</p>
        ) : (
          received.map(({ pair, row }) => (
            <blockquote key={row.id} className="couple-bubble partner">
              <small>
                {pair.partner.nickname} · {t(`pairKind.${pair.kind}`)}
              </small>
              <p lang={row.lang}>{row.body}</p>
              <ReactionBar
                sentence={row}
                mine={reactionMap.get(row.id)?.mine ?? null}
                onReact={(sentenceId, kind) => onReact(sentenceId, kind)}
                t={t}
              />
              <div className="button-row">
                <button className="soft-button" onClick={() => save({ pair, row })}>
                  {t('coupleSave')}
                </button>
                <button className="text-button" onClick={() => onOpen(pair.id)}>
                  {t('feedOpen', { name: pair.partner.nickname })}
                </button>
              </div>
            </blockquote>
          ))
        )}
      </section>

      {joined.length > 0 && (
        <section className="paper-card couple-card" aria-labelledby="feed-compose">
          <h2 id="feed-compose">{t('feedComposeTitle')}</h2>
          {pending.length === 0 ? (
            <p className="muted">{t('feedAllSent')}</p>
          ) : (
            <>
              <p className="muted">
                {t('feedComposeHelp', { names: pending.map((pair) => pair.partner.nickname).join(', ') })}
              </p>
              <Field
                as="textarea"
                label={t('coupleWrite')}
                rows={3}
                maxLength={SENTENCE_MAX}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button className="primary-button" disabled={busy || !draft.trim()} onClick={sendAll}>
                {t('feedSendAll', { count: pending.length })}
              </button>
              <p className="tiny-note">{t('feedSendAllNote')}</p>
            </>
          )}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="paper-card couple-card" aria-labelledby="feed-waiting">
          <h2 id="feed-waiting">{t('feedWaitingTitle')}</h2>
          <p className="muted">{t('coupleWaitHelp')}</p>
          <ul className="pair-waiting-list">
            {waiting.map((pair) => (
              <li key={pair.id}>
                <span className="pair-kind">{t(`pairKind.${pair.kind}`)}</span>
                <span className="couple-code small" aria-label={t('coupleCode')}>
                  {pair.code}
                </span>
                <button className="soft-button" onClick={() => onCopy(pair.code)}>
                  {t('coupleCopy')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button className="soft-button" onClick={onRefresh}>
        {t('coupleRefresh')}
      </button>
    </>
  )
}
