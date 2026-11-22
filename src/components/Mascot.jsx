// 우리 앱의 캐릭터 "말새". 동그란 노란 아기 새로, 연인·친구와 주고받는 말을 물어다 주는 새.
// 얇은 외곽선의 2D 일러스트라 작게 써도 바탕에서 또렷하게 보인다.
// mood: 'happy'(기본, 동그란 눈) 또는 그 밖의 값(웃는 눈)
const LINE = { stroke: 'var(--mascot-line)', strokeWidth: 2, strokeLinejoin: 'round' }

export default function Mascot({ size = 64, mood = 'happy' }) {
  const face = 'var(--mascot-face)'
  const cheek = 'var(--mascot-cheek)'

  return (
    <svg className="mascot" aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      <ellipse cx="50" cy="94" rx="28" ry="3.4" fill="var(--mascot-shadow)" />
      {/* 머리 깃털, 날개, 몸 */}
      <path d="M44 24 C44 17 49 15 50 20 C51 15 56 17 55 24" fill="var(--mascot-body)" {...LINE} />
      <path d="M14 62 C7 58 6 68 13 70" fill="var(--mascot-wing)" {...LINE} />
      <path d="M86 62 C93 58 94 68 87 70" fill="var(--mascot-wing)" {...LINE} />
      <path
        d="M50 24 C72 24 86 40 86 60 C86 79 70 89 50 89 C30 89 14 79 14 60 C14 40 28 24 50 24 Z"
        fill="var(--mascot-body)"
        {...LINE}
      />

      {mood === 'happy' ? (
        <g>
          <ellipse cx="36" cy="55" rx="3.6" ry="4.3" fill={face} />
          <ellipse cx="64" cy="55" rx="3.6" ry="4.3" fill={face} />
          <circle cx="37.3" cy="53.4" r="1.3" fill="#fff" />
          <circle cx="65.3" cy="53.4" r="1.3" fill="#fff" />
        </g>
      ) : (
        <g stroke={face} strokeWidth="2.4" fill="none" strokeLinecap="round">
          <path d="M31.5 56 Q36 51 40.5 56" />
          <path d="M59.5 56 Q64 51 68.5 56" />
        </g>
      )}
      <ellipse cx="26" cy="66" rx="5.6" ry="3.3" fill={cheek} />
      <ellipse cx="74" cy="66" rx="5.6" ry="3.3" fill={cheek} />
      <path d="M46 62 L54 62 L50 67.5 Z" fill="var(--mascot-beak)" stroke="var(--mascot-line)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
