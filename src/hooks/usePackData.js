import { useCallback, useEffect, useState } from 'react'
import { loadPackData, peekPackData } from '../lib/packs'

/** 꾸러미 데이터를 불러온다. 불러오는 동안 data는 null이고, 실패하면 error와 retry를 준다. */
export function usePackData(kind) {
  const [state, setState] = useState({ kind, data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (peekPackData(kind)) return undefined
    let alive = true
    loadPackData(kind).then(
      (data) => alive && setState({ kind, data, error: null }),
      (error) => alive && setState({ kind, data: null, error }),
    )
    return () => {
      alive = false
    }
  }, [kind, attempt])

  const retry = useCallback(() => {
    setState({ kind, data: null, error: null })
    setAttempt((count) => count + 1)
  }, [kind])

  const own = state.kind === kind ? state : { data: null, error: null }
  return { data: peekPackData(kind) ?? own.data, error: own.error, retry }
}
