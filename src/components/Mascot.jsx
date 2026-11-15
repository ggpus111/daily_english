// 우리 앱의 캐릭터 "말랑이". 말랑한 찹쌀떡 몸에 작은 말풍선 꼬리, 머리에 체리 하나.
// 외곽선 없이 면으로만 그려 작게 써도 부드럽게 보인다.
// mood: 'happy'(기본, 동그란 눈) 또는 그 밖의 값(웃는 눈)
export default function Mascot({ size = 64, mood = 'happy' }) {
  const face = 'var(--mascot-face)'

  return (
    <svg className="mascot" aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      <ellipse cx="50" cy="95" rx="26" ry="3.5" fill="var(--mascot-shadow)" />
      <path
        d="M50 22 C74 22 88 42 88 64 C88 84 72 92 50 92 C30 92 13 86 12 66 L6 74 Q4 76 5 73 L11 60 C13 38 28 22 50 22 Z"
        fill="var(--mascot-body)"
      />
      <ellipse cx="38" cy="36" rx="9" ry="4.5" transform="rotate(-20 38 36)" fill="#fff" opacity="0.6" />

      {mood === 'happy' ? (
        <g>
          <ellipse cx="39" cy="60" rx="3.2" ry="3.8" fill={face} />
          <ellipse cx="61" cy="60" rx="3.2" ry="3.8" fill={face} />
          <circle cx="40.1" cy="58.7" r="1.1" fill="#fff" />
          <circle cx="62.1" cy="58.7" r="1.1" fill="#fff" />
        </g>
      ) : (
        <g stroke={face} strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M35 60 Q39 56 43 60" />
          <path d="M57 60 Q61 56 65 60" />
        </g>
      )}
      <ellipse cx="32" cy="68" rx="6" ry="3.6" fill="var(--mascot-cheek)" opacity="0.9" />
      <ellipse cx="68" cy="68" rx="6" ry="3.6" fill="var(--mascot-cheek)" opacity="0.9" />
      <path d="M46 67 Q50 70.5 54 67" stroke={face} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      <path d="M56 16 Q57.5 10 62 8" stroke="var(--mascot-stem)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="63" cy="8" rx="3.4" ry="1.9" transform="rotate(-25 63 8)" fill="var(--mascot-leaf)" />
      <circle cx="56" cy="20" r="5" fill="var(--mascot-cherry)" />
      <circle cx="54.4" cy="18.4" r="1.3" fill="#fff" opacity="0.8" />
    </svg>
  )
}
