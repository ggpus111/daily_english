import { local } from './storage'

// 화면 테마: 'system'(기기 설정 따르기), 'light', 'dark'
export const THEMES = ['system', 'light', 'dark']
const KEY = 'theme'
// 주소창·상태바 색. styles.css의 --surface와 맞춘다.
const BAR_COLOR = { light: '#fcfaf7', dark: '#463832' }

export function getTheme() {
  const saved = local.get(KEY)
  return THEMES.includes(saved) ? saved : 'system'
}

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

/** html 요소에 테마를 적용한다. 'system'이면 표시를 지워 CSS가 기기 설정을 따르게 한다. */
export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[dark ? 'dark' : 'light'])
}

export function saveTheme(theme) {
  local.set(KEY, theme)
  applyTheme(theme)
}

// 기기 설정이 바뀌면 상태바 색도 따라 바꾼다.
export function watchSystemTheme() {
  const query = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (!query) return () => {}
  const onChange = () => applyTheme(getTheme())
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
