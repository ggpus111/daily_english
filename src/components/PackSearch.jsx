import { useMemo, useState } from 'react'
import { useApp } from '../context'
import { usePackData } from '../hooks/usePackData'
import { searchPacks } from '../lib/packSearch'
import ExpressionCard from './ExpressionCard'
import SaveEntryButton from './SaveEntryButton'
import SearchField from './SearchField'

const LIMIT = 20
const CARD_KIND = { expressions: 'expression', words: 'word' }

/**
 * 꾸러미 전체(표현·단어·문법)에서 말을 찾는다. 친구가 보낸 모르는 말을 묶음을 하나씩 눌러 보지 않고 바로 찾게 한다.
 * 검색어가 없으면 아무것도 보여 주지 않아서, 꾸러미 화면의 원래 모습을 해치지 않는다.
 */
export default function PackSearch() {
  const { t, go, nativeLang, learningLang } = useApp()
  const [query, setQuery] = useState('')
  const expressions = usePackData('expressions')
  const words = usePackData('words')
  const grammar = usePackData('grammar')

  const { results, total } = useMemo(
    () =>
      searchPacks(
        [
          { kind: 'expressions', data: expressions.data },
          { kind: 'words', data: words.data },
          { kind: 'grammar', data: grammar.data },
        ],
        query,
        LIMIT,
      ),
    [expressions.data, words.data, grammar.data, query],
  )
  const searching = query.trim().length > 0
  const titleOf = (group) => group.title?.[nativeLang === 'ko' ? 'ko' : 'en'] ?? group.id

  return (
    <section className="stack-form pack-search" aria-label={t('packSearchLabel')}>
      <SearchField label={t('packSearchLabel')} value={query} onChange={setQuery} />
      {!searching && <p className="tiny-note">{t('packSearchHint')}</p>}
      {searching && (
        <p className="tiny-note" role="status">
          {total === 0
            ? t('packSearchEmpty')
            : total > LIMIT
              ? t('packSearchMany', { count: total, shown: LIMIT })
              : t('packSearchCount', { count: total })}
        </p>
      )}
      {searching && total === 0 && (
        <button className="soft-button" onClick={() => go('words')}>
          {t('packSearchAddOwn')}
        </button>
      )}
      {searching && results.length > 0 && (
        <ul className="grammar-pack-list pack-search-results">
          {results.map(({ kind, group, item }) => (
            <li key={`${kind}:${group.id}:${item.id ?? item.text}`}>
              <p className="tiny-note">
                {t(`packSearchKind.${kind}`)} · {titleOf(group)}
              </p>
              {kind === 'grammar' ? (
                <div className="grammar-pack-card">
                  <strong lang={learningLang}>{item.text}</strong>
                  <p>{item.meaning}</p>
                  <p className="grammar-pack-example" lang={learningLang}>
                    {item.example}
                  </p>
                  {item.exampleNative && <p className="muted">{item.exampleNative}</p>}
                  <SaveEntryButton
                    kind="grammar"
                    entry={{
                      text: item.text,
                      meaning: item.meaning,
                      example: item.example,
                      exampleNative: item.exampleNative,
                      source: 'pack',
                    }}
                    label="grammarSave"
                  />
                </div>
              ) : (
                <ExpressionCard item={item} kind={CARD_KIND[kind]} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

