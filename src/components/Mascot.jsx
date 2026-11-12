// 우리 앱의 캐릭터 "말랑이". 대화에서 배운 말을 모으는 앱이라 말풍선 모양이다.
export default function Mascot({ size = 64, mood = 'happy' }) {
  return (
    <svg
      className="mascot"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 64 64"
    >
      <path
        d="M32 6c14.4 0 26 9.6 26 21.6S46.4 49.2 32 49.2c-2 0-4-.2-5.8-.6L15 56.4c-1 .7-2.3-.2-2-1.4l2.6-9.2C9.7 41.7 6 35 6 27.6 6 15.6 17.6 6 32 6z"
        fill="var(--mascot-body)"
      />
      <ellipse cx="21" cy="32" rx="4.2" ry="2.6" fill="var(--mascot-cheek)" />
      <ellipse cx="43" cy="32" rx="4.2" ry="2.6" fill="var(--mascot-cheek)" />
      {mood === 'happy' ? (
        <>
          <path d="M22 25.5q3-3.5 6 0" stroke="var(--mascot-ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M36 25.5q3-3.5 6 0" stroke="var(--mascot-ink)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="25" r="2.4" fill="var(--mascot-ink)" />
          <circle cx="39" cy="25" r="2.4" fill="var(--mascot-ink)" />
        </>
      )}
      <path d="M28.5 33q3.5 3 7 0" stroke="var(--mascot-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
