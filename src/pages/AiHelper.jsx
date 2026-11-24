import { useRef, useState } from 'react'
import Field from '../components/Field'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { giveAiConsent, hasAiConsent, requestCorrection } from '../lib/aiCorrection'
import {
  MAX_HELPER_TEXT,
  buildExplainPrompt,
  buildPolishPrompt,
  buildWeeklyReportPrompt,
  weekJournals,
} from '../lib/aiHelper'
import { languageName } from '../lib/i18n'
import { supabase } from '../lib/supabase'

// Pro의 AI 대화 도우미(#helper): 보내기 전 메시지 다듬기, 받은 메시지 풀이, 주간 AI 리포트.
// 화면은 Pro 회원에게만 열고, 서버 함수도 Pro인지 다시 확인한다(아니면 거절).
const TABS = { polish: 'helperPolish', explain: 'helperExplain', report: 'helperReport' }

export default function AiHelper() {
  const { t, user, isPro, go, onLogin } = useApp()
  const [tab, setTab] = useState('polish')

  if (!supabase || !user) {
    return (
      <>
        <PageHead title={t('helper')} intro={t('helperIntro')} />
        <section className="panel stack-form">
          <p>{t('helperNeedLogin')}</p>
          {supabase && (
            <button className="primary-button" onClick={onLogin}>
              {t('aiLogin')}
            </button>
          )}
        </section>
      </>
    )
  }

  if (!isPro) {
    return (
      <>
        <PageHead title={t('helper')} intro={t('helperIntro')} />
        <section className="panel stack-form">
          <p>{t('helperLocked')}</p>
          <button className="primary-button" onClick={() => go('pro')}>
            {t('helperSeePro')}
          </button>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHead title={t('helper')} intro={t('helperIntro')} />
      <div className="pack-kinds" role="group" aria-label={t('helper')}>
        {Object.entries(TABS).map(([id, label]) => (
          <button key={id} type="button" className="pack-kind" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'report' ? <WeeklyReport /> : <MessageTool key={tab} kind={tab} />}
    </>
  )
}

/** AI에게 묻고 결과를 보여 주는 공통 동작. 동의를 먼저 받고, 연타해도 한 번만 보낸다. */
function useAsk(kind) {
  const { t, notify } = useApp()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [askingConsent, setAskingConsent] = useState(false)
  const busyRef = useRef(false)
  const pending = useRef(null)

  async function ask(prompt, { consented = false } = {}) {
    if (busyRef.current) return
    if (!consented && !hasAiConsent()) {
      pending.current = prompt
      setAskingConsent(true)
      return
    }
    setAskingConsent(false)
    busyRef.current = true
    setBusy(true)
    let response
    try {
      response = await requestCorrection(prompt, kind)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    if (response.error) {
      notify(t(`aiError.${response.error}`) + (response.detail ? ` (${response.detail})` : ''))
      return
    }
    setResult(response.feedback)
  }

  function agree() {
    giveAiConsent()
    if (pending.current) ask(pending.current, { consented: true })
  }

  const consent = askingConsent && (
    <section className="ai-consent" aria-labelledby={`${kind}-consent-title`}>
      <h3 id={`${kind}-consent-title`}>{t('aiConsentTitle')}</h3>
      <p>{t('aiConsentBody')}</p>
      <div className="data-actions">
        <button type="button" className="primary-button" onClick={agree}>
          {t('aiConsentYes')}
        </button>
        <button type="button" className="text-button" onClick={() => setAskingConsent(false)}>
          {t('aiConsentNo')}
        </button>
      </div>
    </section>
  )

  return { busy, result, ask, consent }
}

function Result({ text }) {
  const { t, notify } = useApp()
  if (!text) return null
  const copy = () =>
    navigator.clipboard
      .writeText(text)
      .then(() => notify(t('helperCopied')))
      .catch(() => notify(t('helperCopyFail')))
  return (
    <div className="correction-panel" aria-live="polite">
      <p className="correction-label">{t('helperResult')}</p>
      <p className="ai-result">{text}</p>
      <button type="button" className="text-button" onClick={copy}>
        {t('helperCopy')}
      </button>
    </div>
  )
}

/** 보내기 전 다듬기 / 받은 메시지 풀이: 글을 넣고 버튼을 누르면 결과가 아래에 나온다. */
function MessageTool({ kind }) {
  const { t, notify, nativeLang, learningLang } = useApp()
  const [text, setText] = useState('')
  const { busy, result, ask, consent } = useAsk(kind)
  const langs = { learning: languageName(learningLang, 'en'), explain: languageName(nativeLang, 'en') }

  function submit(event) {
    event.preventDefault()
    if (!text.trim()) {
      notify(t('helperNeedText'))
      return
    }
    ask(kind === 'polish' ? buildPolishPrompt({ ...langs, text }) : buildExplainPrompt({ ...langs, text }))
  }

  return (
    <form className="panel stack-form" onSubmit={submit} noValidate>
      <h2>{t(kind === 'polish' ? 'helperPolish' : 'helperExplain')}</h2>
      <p className="muted">{t(kind === 'polish' ? 'helperPolishBody' : 'helperExplainBody')}</p>
      <Field
        as="textarea"
        label={t(kind === 'polish' ? 'helperPolishLabel' : 'helperExplainLabel')}
        name={`helper-${kind}`}
        rows={4}
        maxLength={MAX_HELPER_TEXT}
        placeholder={t(kind === 'polish' ? 'helperPolishHint' : 'helperExplainHint')}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button className="ai-button" disabled={busy} aria-busy={busy}>
        {t(busy ? 'aiWorking' : kind === 'polish' ? 'helperPolishAsk' : 'helperExplainAsk')}
      </button>
      {consent}
      <Result text={result} />
    </form>
  )
}

/** 주간 AI 리포트: 이번 주 일기와 받은 교정을 모아 한 장으로 정리한다. */
function WeeklyReport() {
  const { t, records, nativeLang, learningLang } = useApp()
  const { busy, result, ask, consent } = useAsk('report')
  const journals = weekJournals(records.journal)

  function make() {
    ask(
      buildWeeklyReportPrompt({
        learning: languageName(learningLang, 'en'),
        explain: languageName(nativeLang, 'en'),
        journals,
      }),
    )
  }

  return (
    <section className="panel stack-form" aria-labelledby="helper-report-title">
      <h2 id="helper-report-title">{t('helperReport')}</h2>
      <p className="muted">{t('helperReportBody')}</p>
      <p className="tiny-note" role="status">
        {t('helperReportCount', { count: journals.length })}
      </p>
      <button type="button" className="ai-button" disabled={busy || journals.length === 0} aria-busy={busy} onClick={make}>
        {t(busy ? 'aiWorking' : 'helperReportAsk')}
      </button>
      {consent}
      <Result text={result} />
    </section>
  )
}
