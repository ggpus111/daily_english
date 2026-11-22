// 기기에 들어 있는 음성 읽기로 발음을 들려준다. 데이터나 비용이 들지 않는다.
// 지원하지 않는 환경(일부 안드로이드 웹뷰 등)에서는 버튼을 숨긴다.

const VOICE_LANG = { en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', fr: 'fr-FR', ko: 'ko-KR' }

export const canSpeak = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'

export function speak(text, language = 'en') {
  if (!canSpeak()) return false
  window.speechSynthesis.cancel()
  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.lang = VOICE_LANG[language] ?? language
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
  return true
}
