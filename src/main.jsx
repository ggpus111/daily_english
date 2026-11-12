import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// 글꼴 CSS가 첫 화면을 막지 않도록 따로 불러온다. 도착 전에는 시스템 글꼴로 보인다.
import('pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
