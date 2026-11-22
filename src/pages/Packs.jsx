import { useState } from 'react'
import ExpressionCard from '../components/ExpressionCard'
import PageHead from '../components/PageHead'
import { useApp } from '../context'
import { usePackData } from '../hooks/usePackData'
import { openExternal } from '../lib/native'
import { START_LEVEL_KEY } from '../components/Onboarding'
import { languageName } from '../lib/i18n'
import { TALK_PACKS, chunks, hasPackData, isSaved } from '../lib/packs'
import { isNative } from '../lib/platform'
import { local } from '../lib/storage'

// 미리 준비한 꾸러미. 표현은 주제별, 단어는 단계별로 보고 고른다. 담은 뒤에는 내 기록처럼 복습한다.
const MODES = {
  expressions: { page: 'packs', kind: 'expression', title: 'packs', intro: 'packsIntro', tab: 'packKindExpressions', count: 589 },
  words: { page: 'packs-words', kind: 'word', title: 'packsWordsTitle', intro: 'packsWordsIntro', tab: 'packKindWords', count: 600 },
}

export default function Packs({ mode = 'expressions' }) {
  const { t, go, learningLang, nativeLang } = useApp()
  const config = MODES[mode]
  const { data, error, retry } = usePackData(mode)

  const head = <PageHead title={t(config.title)} intro={t(config.intro)} />

  // 탭 이름: 지금 보는 꾸러미는 실제 개수, 영어의 다른 꾸러미는 알려진 개수, 아직 없는 언어 꾸러미는 "준비 중"
  function modeLabel(id, item) {
    const plain = t(id === 'words' ? 'packKindWordsPlain' : 'packKindExpressionsPlain')
    if (!hasPackData(id, learningLang)) return t('packKindSoon', { kind: plain })
    if (id === mode && data) return t(item.tab, { count: data.items.length })
    return learningLang === 'en' ? t(item.tab, { count: item.count }) : plain
  }

  if (!hasPackData(mode, learningLang)) {
    return (
      <>
        {head}
        <p className="panel muted">{t('packsComingSoon', { lang: languageName(learningLang, nativeLang) })}</p>
      </>
    )
  }

  return (
    <>
      {head}
      <div className="pack-kinds" role="group" aria-label={t('packKind')}>
        {Object.entries(MODES).map(([id, item]) => (
          <button
            key={id}
            type="button"
            className="pack-kind"
            aria-pressed={id === mode}
            onClick={() => id !== mode && go(item.page)}
          >
            {modeLabel(id, item)}
          </button>
        ))}
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          <p>{t('packsLoadError')}</p>
          <button className="soft-button" onClick={retry}>
            {t('retry')}
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state" role="status">
          {t('packsLoading')}
        </p>
      ) : mode === 'words' ? (
        <WordPacks data={data} />
      ) : (
        <ExpressionPacks data={data} />
      )}

      {data && (
        <SourceNote
          text={t(
            learningLang === 'en' ? (mode === 'words' ? 'wordSource' : 'packSource') : mode === 'words' ? 'wordSourceOther' : 'packSourceOther',
            { count: data.source.sentences.toLocaleString(), lang: languageName(learningLang, nativeLang) },
          )}
        />
      )}
    </>
  )
}

function GroupTabs({ groups, current, onPick, label, heading }) {
  const { nativeLang } = useApp()
  if (groups.length === 0) return null
  return (
    <div className="pack-tabs" role="group" aria-label={label}>
      {heading && (
        <p className="pack-tabs-heading" aria-hidden="true">
          {heading}
        </p>
      )}
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          className="pack-tab"
          aria-pressed={group.id === current}
          onClick={() => onPick(group.id)}
        >
          {group.title[nativeLang === 'ko' ? 'ko' : 'en']}
        </button>
      ))}
    </div>
  )
}

function ExpressionPacks({ data }) {
  const { t, nativeLang, records } = useApp()
  const [packId, setPackId] = useState(data.groups[0].id)
  const pack = data.groups.find((item) => item.id === packId)
  const savedCount = pack.items.filter((item) => isSaved(item, records.expression)).length

  return (
    <>
      {/* 외국인 연인·친구와 주고받는 말을 먼저, 처음 만든 일상 표현을 뒤에 따로 묶어 보여 준다 */}
      <GroupTabs
        groups={data.groups.filter((group) => TALK_PACKS.includes(group.id))}
        current={packId}
        onPick={setPackId}
        label={t('packsTalkGroup')}
        heading={t('packsTalkGroup')}
      />
      <GroupTabs
        groups={data.groups.filter((group) => !TALK_PACKS.includes(group.id))}
        current={packId}
        onPick={setPackId}
        label={t('packsDailyGroup')}
        heading={t('packsDailyGroup')}
      />
      <section className="panel pack-panel" aria-labelledby="pack-title">
        <div className="section-head">
          <h2 id="pack-title">{pack.title[nativeLang === 'ko' ? 'ko' : 'en']}</h2>
          <span className="count">{t('packProgress', { saved: savedCount, total: pack.items.length })}</span>
        </div>
        <div className="expression-list">
          {pack.items.map((item) => (
            <ExpressionCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </>
  )
}

function WordPacks({ data }) {
  const { t, nativeLang, records } = useApp()
  // 첫 실행 안내에서 고른 단계부터 보여 준다.
  const [levelId, setLevelId] = useState(() => {
    const saved = local.get(START_LEVEL_KEY)
    return data.groups.some((group) => group.id === saved) ? saved : data.groups[0].id
  })
  const [chunkIndex, setChunkIndex] = useState(0)
  const level = data.groups.find((item) => item.id === levelId)
  const parts = chunks(level.items)
  const part = parts[Math.min(chunkIndex, parts.length - 1)]
  const savedCount = level.items.filter((item) => isSaved(item, records.word)).length

  function pickLevel(id) {
    setLevelId(id)
    setChunkIndex(0)
  }

  return (
    <>
      <GroupTabs groups={data.groups} current={levelId} onPick={pickLevel} label={t('packLevel')} />
      <section className="panel pack-panel" aria-labelledby="pack-title">
        <div className="section-head">
          <h2 id="pack-title">{level.title[nativeLang === 'ko' ? 'ko' : 'en']}</h2>
          <span className="count">{t('packProgress', { saved: savedCount, total: level.items.length })}</span>
        </div>
        <div className="chunk-tabs" role="group" aria-label={t('packRange')}>
          {parts.map((item) => (
            <button
              key={item.index}
              type="button"
              className="chunk-tab"
              aria-pressed={item.index === part.index}
              onClick={() => setChunkIndex(item.index)}
            >
              {item.from}–{item.to}
            </button>
          ))}
        </div>
        <div className="expression-list">
          {part.items.map((item) => (
            <ExpressionCard key={item.id} item={item} kind="word" />
          ))}
        </div>
      </section>
    </>
  )
}

function SourceNote({ text }) {
  return (
    <p className="tiny-note pack-source">
      {text}{' '}
      <a
        className="inline-link"
        href="https://tatoeba.org"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (!isNative) return
          event.preventDefault()
          openExternal('https://tatoeba.org')
        }}
      >
        Tatoeba
      </a>{' '}
      (CC BY 2.0 FR)
    </p>
  )
}
