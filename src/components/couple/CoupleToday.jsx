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
import Sticker from '../dani/Sticker'
import Field from '../Field'

/** 상대 문장 아래의 다니 이모티콘 버튼들. 누른 걸 다시 누르면 지운다. 오늘 모아보기(TodayFeed)도 함께 쓴다. */
export function ReactionBar({ sentence, mine, onReact, t }) {
  return (
    <div className="reaction-bar sticker-bar" role="group" aria-label={t('reactLabel')}>
      {REACTIONS.map((kind) => (
        <button
          key={kind}
          className="sticker-chip"
          aria-pressed={mine === kind}
          onClick={() => onReact(sentence.id, mine === kind ? null : kind)}
        >
          <Sticker kind={kind} size={44} />
          <span className="sr-only">{t(`reaction.${kind}`)}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * 상대 한 사람과 주고받는 화면: 오늘 주고받은 문장(보낸 순서)과 지난 문장. 하루에 몇 번이든 보낼 수 있다.
 * onSend(문장)과 onEdit(문장 번호, 문장)은 성공하면 true를 돌려준다.
 */
export default function CoupleToday({ userId, partner, sentences, reactions = [], onSend, onEdit, onReact, onRefresh }) {
  const { t, learningLang, add, notify } = useApp()
  const talk = usePackData('expressions')
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => groupByDay(sentences, userId), [sentences, userId])
  const reactionMap = useMemo(() => reactionsBySentence(reactions, userId), [reactions, userId])
  const reactionOf = (sentence) => reactionMap.get(sentence.id) ?? { mine: null, theirs: null }
  const streak = useMemo(() => exchangeStreak(days), [days])
  const suggestion = useMemo(() => suggestionFor(talk.data), [talk.data])
  const today = days[0]
  const editing = editingId !== null

  async function send() {
    setBusy(true)
    const ok = editing ? await onEdit(editingId, draft) : await onSend(draft)
    setBusy(false)
    if (!ok) return
    setDraft('')
    setEditingId(null)
  }

  function startEdit(row) {
    setDraft(row.body)
    setEditingId(row.id)
  }

  function cancelEdit() {
    setDraft('')
    setEditingId(null)
  }

  async function save(row) {
    const result = await add('expression', {
      text: row.body,
      meaning: t('coupleSavedFrom', { name: partner.nickname }),
      example: '',
    })
    notify(result.error ? t('coupleError', { message: errorMessage(result.error, t) }) : t('coupleSaved'))
  }

  function bubble(row) {
    if (row.user_id !== userId) {
      return (
        <blockquote key={row.id} className="couple-bubble partner">
          <small>{partner.nickname}</small>
          <p lang={row.lang}>{row.body}</p>
          <ReactionBar sentence={row} mine={reactionOf(row).mine} onReact={onReact} t={t} />
          <button className="soft-button" onClick={() => save(row)}>
            {t('coupleSave')}
          </button>
        </blockquote>
      )
    }
    const got = reactionOf(row).theirs
    return (
      <blockquote key={row.id} className="couple-bubble mine">
        <small>{t('coupleMine')}</small>
        <p lang={row.lang}>{row.body}</p>
        {got && (
          <p className="reaction-got sticker-got" role="status">
            <Sticker kind={got} size={64} />
            {t('reactGot', { name: partner.nickname, reaction: t(`reaction.${got}`) })}
          </p>
        )}
        {editingId !== row.id && (
          <button className="soft-button" onClick={() => startEdit(row)}>
            {t('coupleEdit')}
          </button>
        )}
      </blockquote>
    )
  }

  return (
    <>
      <section className="paper-card couple-card" aria-labelledby="couple-today">
        <div className="section-head">
          <h2 id="couple-today">{t('coupleToday')}</h2>
          <span className="count">{t('coupleStreak', { count: streak })}</span>
        </div>

        {today.rows.length === 0 && <p className="muted">{t('couplePartnerWaiting', { name: partner.nickname })}</p>}
        {today.rows.length > 0 && <div className="couple-thread">{today.rows.map(bubble)}</div>}

        {suggestion && today.mine.length === 0 && !editing && (
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
          label={editing ? t('coupleEditLabel') : t('coupleWrite')}
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
            <button className="soft-button" onClick={cancelEdit}>
              {t('cancel')}
            </button>
          )}
        </div>
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
                {group.rows.map((row) =>
                  row.user_id === userId ? (
                    <p key={row.id} lang={row.lang}>
                      <b>{t('coupleMine')}</b> {row.body}
                      {reactionOf(row).theirs && (
                        <span className="reaction-got"> · {t(`reaction.${reactionOf(row).theirs}`)}</span>
                      )}
                    </p>
                  ) : (
                    <div key={row.id}>
                      <p lang={row.lang}>
                        <b>{partner.nickname}</b> {row.body}{' '}
                        <button className="inline-link" onClick={() => save(row)}>
                          {t('coupleSave')}
                        </button>
                      </p>
                      <ReactionBar sentence={row} mine={reactionOf(row).mine} onReact={onReact} t={t} />
                    </div>
                  ),
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
