import Dani from './Dani'

// 로고: 노란 둥근 사각형 안에서 책을 읽는 다니 + 기울인 굵은 "Daily English".
// 마크와 글자는 장식이라 보조 기술에는 숨기고, 이름은 따로 읽어 준다.
export function LogoMark({ size = 34 }) {
  return (
    <span className="logo-mark dani-logo-mark" aria-hidden="true" style={{ width: size, height: size }}>
      <Dani pose="book" size={Math.round(size * 0.92)} className="dani" />
    </span>
  )
}

const MARK_SIZE = { md: 36, lg: 56 }

export default function Logo({ size = 'md' }) {
  return (
    <span className={`logo logo-${size}`}>
      <LogoMark size={MARK_SIZE[size]} />
      <span className="wordmark" aria-hidden="true">
        Daily English
      </span>
      <span className="sr-only">Daily English</span>
    </span>
  )
}
