// 로고: 친구 앱의 "d." 마크를 다듬은 피치색 둥근 사각형 + "daily english" 글자.
// 마크와 글자는 장식이라 보조 기술에는 숨기고, 이름은 따로 읽어 준다.
export function LogoMark({ size = 34 }) {
  return (
    <svg className="logo-mark" aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      <rect x="0" y="0" width="100" height="100" rx="26" fill="var(--logo-bg)" />
      <text x="45" y="68" textAnchor="middle" fontSize="62" fontWeight="800" letterSpacing="-2" fill="#fff">
        d
      </text>
      <circle cx="72" cy="63" r="6" fill="#fff" />
    </svg>
  )
}

const MARK_SIZE = { md: 34, lg: 52 }

export default function Logo({ size = 'md' }) {
  return (
    <span className={`logo logo-${size}`}>
      <LogoMark size={MARK_SIZE[size]} />
      <span className="wordmark" aria-hidden="true">
        daily english
      </span>
      <span className="sr-only">Daily English</span>
    </span>
  )
}
