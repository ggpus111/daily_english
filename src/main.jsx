import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { backupDraftOnPause, restoreDraft } from './lib/draftBackup'
import { initErrorTracking } from './lib/errorLog'
import { applyTheme, getTheme, watchSystemTheme } from './lib/theme'
import './styles.css'

// 처리하지 못한 오류를 모은다(오류 추적).
initErrorTracking()

// 첫 화면을 그리기 전에 테마를 정해 깜빡임을 줄인다.
applyTheme(getTheme())
watchSystemTheme()

// 웹은 글꼴 CSS가 첫 화면을 막지 않도록 따로 불러온다(필요한 글자 조각만 받는다). 도착 전에는 시스템 글꼴로 보인다.
// 안드로이드 앱(--mode app)은 글꼴 파일(약 3.3MB)을 앱에 넣지 않고 휴대폰 글꼴을 쓴다.
// Pretendard의 한글은 안드로이드 기본 한글 글꼴(Noto Sans CJK, 본고딕)을 바탕으로 해서 거의 같게 보인다.
if (import.meta.env.MODE !== 'app') import('pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css')

// 안드로이드 앱: 앱이 꺼진 사이 사라진 쓰던 일기를 휴대폰 파일에서 되살린 뒤 그린다(웹은 바로 그린다).
backupDraftOnPause()
restoreDraft().finally(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
