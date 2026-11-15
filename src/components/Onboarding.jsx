import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { usePackData } from '../hooks/usePackData'
import { errorMessage } from '../lib/errors'
import { toEntry } from '../lib/packs'
import { local } from '../lib/storage'
import Field from './Field'
import Mascot from './Mascot'
import MoodPicker from './MoodPicker'
import { UsageLine } from './Usage'

export const ONBOARDED_KEY = 'onboarded'
export const START_LEVEL_KEY = 'startLevel'

// 첫날 바로 쓸 수 있게 고른 표현(일상 대화·문제 해결 꾸러미)
const STARTERS = ["How's it going?", 'Pretty good', 'hang out', 'No idea', 'Sounds good.', 'Take care', 'by the way', 'figure out', "I'm good"]
const STEPS = 3

/** 기록이 하나도 없는 첫 실행인지. 저장소가 막혀 "봤음"을 남길 수 없으면 매번 뜨지 않게 건너뛴다. */
export function needsOnboarding(records, learningLang) {
  if (learningLang !== 'en' || local.get(ONBOARDED_KEY)) return false
  if (!Object.values(records).every((items) => items.length === 0)) return false
  return local.set(`${ONBOARDED_KEY}-check`, '1') && (local.remove(`${ONBOARDED_KEY}-check`), true)
}

// 첫 실행 안내: 수준 고르기 → 표현 담기 → 기분 고르고 한 줄 일기. 어느 단계에서든 건너뛸 수 있다.
export default function Onboarding({ onDone }) {
  const { t, notify, add } = useApp()
  const [step, setStep] = useState(1)
  const [level, setLevel] = useState('beginner')
  const [picked, setPicked] = useState([])
  const [journal, setJournal] = useState({ mood: '', native: '', translation: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const headingRef = useRef(null)
  const { data } = usePackData('expressions')
  const starters = data ? STARTERS.map((text) => data.items.find((item) => item.text === text)).filter(Boolean) : []

  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  function finish(message) {
    local.set(ONBOARDED_KEY, '1')
    if (message) notify(message)
    onDone()
  }

  async function next() {
    if (step === 1) {
      local.set(START_LEVEL_KEY, level)
      setStep(2)
      return
    }
    if (step === 2) {
      setSaving(true)
      for (const item of starters.filter((entry) => picked.includes(entry.id))) {
        const result = await add('expression', toEntry(item))
        if (result.error) {
          setSaving(false)
          notify(t('saveError', { message: errorMessage(result.error, t) }))
          return
        }
      }
      setSaving(false)
      setStep(3)
      return
    }
    if (!journal.native.trim()) {
      setError(t('fieldRequired'))
      return
    }
    setSaving(true)
    const result = await add('journal', {
      mood: journal.mood,
      native: journal.native.trim(),
      translation: journal.translation.trim(),
      aiFeedback: '',
      memo: '',
    })
    setSaving(false)
    if (result.error) notify(t('saveError', { message: errorMessage(result.error, t) }))
    else finish(t('onboardDone'))
  }

  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))

  return (
    <section className="onboarding panel" aria-labelledby="onboard-title">
      <div className="onboard-top">
        <Mascot size={52} mood={step === 3 ? 'joy' : 'happy'} />
        <p className="onboard-progress">{t('onboardProgress', { step, total: STEPS })}</p>
      </div>
      <h1 id="onboard-title" ref={headingRef} tabIndex={-1}>
        {t(`onboardTitle${step}`)}
      </h1>
      <p className="muted">{t(`onboardIntro${step}`)}</p>

      {step === 1 && (
        <div className="onboard-choices" role="group" aria-label={t('onboardTitle1')}>
          {['beginner', 'intermediate'].map((id) => (
            <button key={id} type="button" className="onboard-choice" aria-pressed={level === id} onClick={() => setLevel(id)}>
              <strong>{t(`onboardLevel.${id}`)}</strong>
              <span>{t(`onboardLevelHint.${id}`)}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <>
          <div className="onboard-picks" role="group" aria-label={t('onboardTitle2')}>
            {starters.map((item) => (
              <button
                key={item.id}
                type="button"
                className="onboard-pick"
                aria-pressed={picked.includes(item.id)}
                onClick={() => toggle(item.id)}
              >
                <strong lang="en">{item.text}</strong>
                <span>{item.meaning}</span>
              </button>
            ))}
          </div>
          <p className="tiny-note" aria-live="polite">
            {t('onboardPicked', { count: picked.length })}
          </p>
        </>
      )}

      {step === 3 && (
        <div className="stack-form">
          <MoodPicker value={journal.mood} onChange={(mood) => setJournal((value) => ({ ...value, mood }))} />
          <Field
            label={t('onboardNative')}
            name="native"
            required
            maxLength={4000}
            value={journal.native}
            error={error}
            onChange={(event) => {
              setError('')
              setJournal((value) => ({ ...value, native: event.target.value }))
            }}
          />
          <Field
            label={t('onboardTranslation')}
            name="translation"
            maxLength={4000}
            lang="en"
            placeholder={t('onboardTranslationHint')}
            value={journal.translation}
            onChange={(event) => setJournal((value) => ({ ...value, translation: event.target.value }))}
          />
          <UsageLine sentence={journal.translation} live />
        </div>
      )}

      <div className="onboard-actions">
        <button className="primary-button" disabled={saving || (step === 2 && !data)} onClick={next}>
          {t(step === STEPS ? 'onboardFinish' : 'onboardNext')}
        </button>
        <button className="text-button" onClick={() => finish()}>
          {t('onboardSkip')}
        </button>
      </div>
    </section>
  )
}
