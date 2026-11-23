import { useMemo, useState } from 'react'
import { useApp } from '../../context'
import { usePackData } from '../../hooks/usePackData'
import {
  REACTIONS,
  SENTENCE_MAX,
  exchangeStreak,
  groupByDay,
  reactionsBySentence,
  suggestionFor,
} from '../../lib/couple'
import { errorMessage } from '../../lib/errors'
import Field from '../Field'

/** 상대 문장 아래의 반응 버튼들. 누른 걸 다시 누르면 지운다. 오늘 모아보기(TodayFeed)도 함께 쓴다. */
export function ReactionBar({ sentence, mine, onReact, t }) {
  return (
    <div className="reaction-bar" role="group" aria-label={t('reactLabel')}>
      {REACTIONS.map((kind) => (
        <button
          key={kind}
          className="reaction-chip"
          aria-pressed={mine === kind}
          onClick={() => onReact(sentence.id, mine === kind ? null : kind)}
        >
          {t(`reaction.${kind}`)}
        </button>
      ))}
    </div>
  )
}

/** 상대 한 사람과 주고받는 화면: 오늘의 한 문장과 지난 문장. onSend(문장)은 보냈으면 true를 돌려준다. */
export default function CoupleToday({ userId, partner, sentences, reactions = [], onSend, onReact, onRefresh }) {
  const { t, learningLang, add, notify } = useApp()
  const talk = usePackData('expressions')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => groupByDay(sentences, userId), [sentences, userId])
  const reactionMap = useMemo(() => reactionsBySentence(reactions, userId), [reactions, userId])
  const reactionOf = (sentence) => reactionMap.get(sentence.id) ?? { mine: null, theirs: null }
  const streak = useMemo(() => exchangeStreak(days), [days])
  const suggestion = useMemo(() => suggestionFor(talk.data), [talk.data])
  const today = days[0]
  const showForm = !today.mine || editing

  async function send() {
    setBusy(true)
    const ok = await onSend(draft)
    setBusy(false)
    if (!ok) return
    setDraft('')
    setEditing(false)
  }

  async function save(row) {
    const result = await add('expression', {
      text: row.body,
      meaning: t('coupleSavedFrom', { name: partner.nickname }),
      example: '',
    })
    notify(result.error ? t('coupleError', { message: errorMessage(result.error, t) }) : t('coupleSaved'))
  }

  return (
    <>
      <section className="paper-card couple-card" aria-labelledby="couple-today">
        <div className="section-head">
          <h2 id="couple-today">{t('coupleToday')}</h2>
          <span className="count">{t('coupleStreak', { count: streak })}</span>
        </div>

        {today.partner ? (
          <blockquote className="couple-bubble partner">
            <small>{partner.nickname}</small>
            <p lang={today.partner.lang}>{today.partner.body}</p>
            <ReactionBar sentence={today.partner} mine={reactionOf(today.partner).mine} onReact={onReact} t={t} />
            <button className="soft-button" onClick={() => save(today.partner)}>
              {t('coupleSave')}
            </button>
          </blockquote>
        ) : (
          <p className="muted">{t('couplePartnerWaiting', { name: partner.nickname })}</p>
        )}

        {today.mine && !editing && (
          <blockquote className="couple-bubble mine">
            <small>{t('coupleMine')}</small>
            <p lang={today.mine.lang}>{today.mine.body}</p>
            {reactionOf(today.mine).theirs && (
              <p className="reaction-got" role="status">
                {t('reactGot', { name: partner.nickname, reaction: t(`reaction.${reactionOf(today.mine).theirs}`) })}
              </p>
            )}
            <button
              className="soft-button"
              onClick={() => {
                setDraft(today.mine.body)
                setEditing(true)
              }}
            >
              {t('coupleEdit')}
            </button>
          </blockquote>
        )}

        {showForm && (
          <>
            {suggestion && (
              <div className="couple-suggest">
                <p className="eyebrow">{t('coupleSuggest')}</p>
                <p lang={learningLang}>
                  <strong>{suggestion.text}</strong>
                </p>
                <p className="muted">{suggestion.meaning}</p>
                <button className="soft-button" onClick={() => setDraft(suggestion.text)}>
                  {t('coupleUseSuggestion')}
                </button>
              </div>
            )}
            <Field
              as="textarea"
              label={t('coupleWrite')}
              rows={3}
              maxLength={SENTENCE_MAX}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="button-row">
              <button className="primary-button" disabled={busy || !draft.trim()} onClick={send}>
                {editing ? t('coupleSaveEdit') : t('coupleSend')}
              </button>
              {editing && (
                <button className="soft-button" onClick={() => setEditing(false)}>
                  {t('cancel')}
                </button>
              )}
            </div>
          </>
        )}
        <button className="soft-button" onClick={onRefresh}>
          {t('coupleRefresh')}
        </button>
      </section>

      {days.length > 1 && (
        <section className="paper-card couple-card" aria-labelledby="couple-history">
          <h2 id="couple-history">{t('coupleHistory')}</h2>
          <ol className="couple-history">
            {days.slice(1).map((group) => (
              <li key={group.day}>
                <time dateTime={group.day}>{group.day}</time>
                {group.partner && (
                  <p lang={group.partner.lang}>
                    <b>{partner.nickname}</b> {group.partner.body}{' '}
                    <button className="inline-link" onClick={() => save(group.partner)}>
                      {t('coupleSave')}
                    </button>
                  </p>
                )}
                {group.partner && (
                  <ReactionBar sentence={group.partner} mine={reactionOf(group.partner).mine} onReact={onReact} t={t} />
                )}
                {group.mine && (
                  <p lang={group.mine.lang}>
                    <b>{t('coupleMine')}</b> {group.mine.body}
                    {reactionOf(group.mine).theirs && (
                      <span className="reaction-got"> · {t(`reaction.${reactionOf(group.mine).theirs}`)}</span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
