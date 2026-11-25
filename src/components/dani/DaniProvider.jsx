import { createContext, useContext } from 'react'
import { useApp } from '../../context'
import { useDani } from '../../hooks/useDani'
import { usePackData } from '../../hooks/usePackData'
import { readPurpose } from '../../lib/purpose'
import LevelUpDialog from './LevelUpDialog'

const DaniContext = createContext(null)

/** 다니 키우기 상태를 화면 전체에 나눠 주고, 단계가 오르면 축하 창을 띄운다. */
export function DaniProvider({ children }) {
  const { records } = useApp()
  // "오늘의 표현을 일기에 쓴 날" 점수에 쓰는 꾸러미(홈의 오늘의 표현과 같은 데이터, 한 번만 받는다)
  const { data } = usePackData('expressions')
  const dani = useDani(records, { expressionItems: data?.items, purpose: readPurpose() })
  return (
    <DaniContext.Provider value={dani}>
      {children}
      {dani.levelUp !== null && <LevelUpDialog level={dani.levelUp} colors={dani.colors} onClose={dani.closeLevelUp} />}
    </DaniContext.Provider>
  )
}

export const useDaniState = () => useContext(DaniContext)
