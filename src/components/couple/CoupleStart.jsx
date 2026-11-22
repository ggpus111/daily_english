import { useState } from 'react'
import { useApp } from '../../context'
import { NICKNAME_MAX, createCouple, isValidCode, joinCouple, normalizeCode } from '../../lib/couple'
import Field from '../Field'

/** 짝이 없을 때: 새로 만들거나 초대 번호로 들어간다. run은 서버 호출을 하고 화면을 새로 불러오는 함수. */
export default function CoupleStart({ busy, run }) {
  const { t, nickname } = useApp()
  const [name, setName] = useState(nickname.slice(0, NICKNAME_MAX))
  const [code, setCode] = useState('')

  return (
    <div className="couple-grid">
      <section className="paper-card couple-card" aria-labelledby="couple-new">
        <h2 id="couple-new">{t('coupleCreateTitle')}</h2>
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
          onClick={() => run(() => createCouple(name))}
        >
          {t('coupleCreate')}
        </button>
      </section>
      <section className="paper-card couple-card" aria-labelledby="couple-join">
        <h2 id="couple-join">{t('coupleJoinTitle')}</h2>
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
        <button
          className="primary-button"
          disabled={busy || !isValidCode(code) || !name.trim()}
          onClick={() => run(() => joinCouple(code, name))}
        >
          {t('coupleJoin')}
        </button>
      </section>
    </div>
  )
}
