import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context'
import { hasPackData, loadPackData, peekPackData } from '../lib/packs'

/**
 * 배우는 언어의 꾸러미 데이터를 불러온다. 불러오는 동안 data는 null이고, 실패하면 error와 retry를 준다.
 * 아직 그 언어 꾸러미가 없으면 missing이 true다.
 */
export function usePackData(kind) {
  const { learningLang } = useApp()
  const lang = learningLang ?? 'en'
  const missing = !hasPackData(kind, lang)
  const key = `${kind}:${lang}`
  const [state, setState] = useState({ key, data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (missing || peekPackData(kind, lang)) return undefined
    let alive = true
    loadPackData(kind, lang).then(
      (data) => alive && setState({ key, data, error: null }),
      (error) => alive && setState({ key, data: null, error }),
    )
    return () => {
      alive = false
    }
  }, [kind, lang, key, missing, attempt])

  const retry = useCallback(() => {
    setState({ key, data: null, error: null })
    setAttempt((count) => count + 1)
  }, [key])

  const own = state.key === key ? state : { data: null, error: null }
  return { data: missing ? null : (peekPackData(kind, lang) ?? own.data), error: own.error, retry, missing, lang }
}
