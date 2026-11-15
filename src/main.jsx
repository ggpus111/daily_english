import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applyTheme, getTheme, watchSystemTheme } from './lib/theme'
import './styles.css'

// 첫 화면을 그리기 전에 테마를 정해 깜빡임을 줄인다.
applyTheme(getTheme())
watchSystemTheme()

// 글꼴 CSS가 첫 화면을 막지 않도록 따로 불러온다. 도착 전에는 시스템 글꼴로 보인다.
import('pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
