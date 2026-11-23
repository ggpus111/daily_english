import { useState } from 'react'
import { useApp } from '../../context'
import {
  MAX_FRIENDS,
  NICKNAME_MAX,
  PAIR_KINDS,
  canAddKind,
  createCouple,
  isValidCode,
  joinCouple,
  normalizeCode,
} from '../../lib/couple'
import ChoiceChips from '../ChoiceChips'
import Field from '../Field'

/**
 * 상대 추가: 연인이나 친구로 초대 번호를 새로 만들거나, 받은 번호로 들어간다.
 * 연인은 한 명, 친구는 MAX_FRIENDS명까지라 이미 꽉 찬 종류는 고를 수 없다(서버도 한 번 더 막는다).
 * run은 서버 호출을 하고 화면을 새로 불러오는 함수, onDone은 끝나면 오늘 모아보기로 돌아가게 한다.
 */
export default function AddPair({ pairs, busy, run, onDone }) {
  const { t, nickname } = useApp()
  const open = PAIR_KINDS.filter((kind) => canAddKind(pairs, kind))
  const [kind, setKind] = useState(open[0] ?? 'friend')
  const [name, setName] = useState(nickname.slice(0, NICKNAME_MAX))
  const [code, setCode] = useState('')
  const full = PAIR_KINDS.filter((value) => !open.includes(value))
  const fullNote = full.map((value) =>
    t(value === 'partner' ? 'pairPartnerFull' : 'pairFriendFull', { max: MAX_FRIENDS }),
  )

  return (
    <div className="couple-grid">
      <section className="paper-card couple-card" aria-labelledby="pair-new">
        <h2 id="pair-new">{t('coupleCreateTitle')}</h2>
        {open.length > 0 ? (
          <>
            <ChoiceChips
              label={t('pairKindLegend')}
              options={open.map((value) => ({ value, label: t(`pairKind.${value}`) }))}
              value={kind}
              onChange={setKind}
              hint={fullNote.join(' ') || undefined}
              compact
            />
            <p className="muted">{t('coupleCreateHelp')}</p>
            <Field
              label={t('coupleMyName')}
              value={name}
              maxLength={NICKNAME_MAX}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              className="primary-button"
              disabled={busy || !name.trim()}
              onClick={() => run(() => createCouple(name, kind), onDone)}
            >
              {t('coupleCreate')}
            </button>
          </>
        ) : (
          <p className="muted">{fullNote.join(' ')}</p>
        )}
      </section>
      <section className="paper-card couple-card" aria-labelledby="pair-join">
        <h2 id="pair-join">{t('coupleJoinTitle')}</h2>
        <p className="muted">{t('coupleJoinHelp')}</p>
        <Field
          label={t('coupleCode')}
          value={code}
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setCode(normalizeCode(event.target.value))}
        />
        {open.length === 0 && (
          <Field
            label={t('coupleMyName')}
            value={name}
            maxLength={NICKNAME_MAX}
            onChange={(event) => setName(event.target.value)}
          />
        )}
        <button
          className="primary-button"
          disabled={busy || !isValidCode(code) || !name.trim()}
          onClick={() => run(() => joinCouple(code, name), onDone)}
        >
          {t('coupleJoin')}
        </button>
      </section>
    </div>
  )
}
