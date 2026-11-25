// 우리 앱의 캐릭터 "다니". 로고처럼 굵은 검정 외곽선, 하얀 얼굴, 올림머리.
// pose: 성장 단계('peek' | 'book' | 'chat' | 'cheer' | 'doctor') 또는 얼굴만('face')
// mood: 'dot' | 'joy' | 'sleepy' | 'cool' | 'curious'
// colors: { hair, top, item } (src/lib/growth.js의 DANI_COLORS 안에서만 고른다)
import { useId } from 'react'
import { DEFAULT_DANI } from '../lib/growth'

const K = '#1b1b1b'
const STROKE = { stroke: K, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }
const YELLOW = '#f6c945'
const darkColor = (color) => color === K || color === '#6b4430'

function starPath(x, y, r) {
  const a = r * 0.14
  const b = r * 0.3
  return `M${x} ${y - r} C${x + a} ${y - b} ${x + b} ${y - a} ${x + r} ${y} C${x + b} ${y + a} ${x + a} ${y + b} ${x} ${y + r} C${x - a} ${y + b} ${x - b} ${y + a} ${x - r} ${y} C${x - b} ${y - a} ${x - a} ${y - b} ${x} ${y - r} Z`
}
const Sparkle = ({ x, y, r = 5 }) => <path d={starPath(x, y, r)} fill={YELLOW} {...STROKE} strokeWidth={1.8} />
// 움직임 선: 서로 떨어진 짧은 선 세 개가 머리 쪽으로 퍼진다(로고와 같은 모양).
const Pop = ({ x, y, s = 1 }) => (
  <g stroke={K} strokeWidth={4 * s} strokeLinecap="round">
    <path d={`M${x + 4 * s} ${y - 7.5 * s} L${x + 9.5 * s} ${y - 1.5 * s}`} />
    <path d={`M${x + 15.5 * s} ${y - 14.5 * s} L${x + 18 * s} ${y - 6 * s}`} />
    <path d={`M${x - 3 * s} ${y + 6.5 * s} L${x + 5 * s} ${y + 8 * s}`} />
  </g>
)
const Hand = ({ x, y, r = 6 }) => <circle cx={x} cy={y} r={r} fill="#fff" {...STROKE} />
const Arm = ({ d, top, width = 9 }) => (
  <>
    <path d={d} fill="none" stroke={K} strokeWidth={width + 6} strokeLinecap="round" />
    <path d={d} fill="none" stroke={top} strokeWidth={width} strokeLinecap="round" />
  </>
)
const Mark = ({ x, y, children, size = 22 }) => (
  <text x={x} y={y} fontSize={size} fontWeight="900" fill={K} fontFamily="system-ui, sans-serif">
    {children}
  </text>
)

function Eyes({ mood }) {
  if (mood === 'joy')
    return (
      <g fill="none" stroke={K} strokeWidth="3.2" strokeLinecap="round">
        <path d="M40.5 52 Q45 46 49.5 52" />
        <path d="M53 52 Q57.5 46 62 52" />
      </g>
    )
  if (mood === 'sleepy')
    return (
      <g fill="none" stroke={K} strokeWidth="3" strokeLinecap="round">
        <path d="M41 51 H49" />
        <path d="M53.5 51 H61.5" />
      </g>
    )
  if (mood === 'cool')
    return (
      <>
        <path d="M38 45 H65 L64 52 C63 57 56 57 55 52 L54 48.5 H49 L48 52 C47 57 40 57 39 52 Z" fill={K} />
        <path d="M42 47 L45 47" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </>
    )
  return (
    <>
      <rect x="42.5" y="45" width="5.2" height="10.5" rx="2.6" fill={K} />
      <rect x="55" y="45" width="5.2" height="10.5" rx="2.6" fill={K} />
    </>
  )
}

function Head({ colors, cy = 44, mood = 'dot', phones = false, cap = false }) {
  const { hair, item } = colors
  return (
    <g transform={`translate(0 ${cy - 44})`}>
      {/* 로고(책 읽는 다니)와 같은 머리: 올림머리, 가르마 끝이 위로 뾰족, 왼쪽 앞머리는 둥글게, 오른쪽 앞머리는 비스듬히, 왼쪽 잔머리 */}
      {!cap && <circle cx="71" cy="16" r="11.5" fill={hair} {...STROKE} />}
      <path
        d="M27 60 C21 47 23 34 30 26 C37 19 45 15.5 52.5 15.2 C60 15 66 16.5 70 19 C78 24 82 32 82.5 42 C83 51 81 59 76 65 C74 66.5 71.5 66.5 70 65 Z"
        fill={hair}
        {...STROKE}
      />
      <path
        d="M49.5 24 C48 29 44.5 33 40 36 C36 38.5 33 41.5 31.5 45 C29.8 49.5 29.6 54.5 31.6 58.6 C35.4 64.8 42.6 68 51 68 C59.4 68 66.4 64.8 70.2 59.4 C72 56.8 72.6 53.4 72 50.4 C66 46 59.5 40.8 55.5 35.4 C52.8 31.8 50.6 28 49.5 24 Z"
        fill="#fff"
        {...STROKE}
      />
      <path
        d="M33 39 C29 43.5 27.8 49 29.2 54 C27.6 57.6 23.6 60 19.8 59.2 C22.6 57.2 23.8 54.2 23.6 50.2 C23.4 45 26 40 30.4 36 Z"
        fill={hair}
        {...STROKE}
      />
      <Eyes mood={mood} />
      {phones && (
        <>
          <path d="M25 53 C19 13 83 11 77 51" fill="none" stroke={K} strokeWidth="7" strokeLinecap="round" />
          {item !== K && <path d="M25 53 C19 13 83 11 77 51" fill="none" stroke={item} strokeWidth="3.2" strokeLinecap="round" />}
          <circle cx="77.5" cy="54" r="7.5" fill={item} {...STROKE} />
          <circle cx="24.5" cy="54" r="10" fill={item} {...STROKE} />
          <path d={starPath(24.5, 54, 5.6)} fill={darkColor(item) ? '#fff' : K} />
        </>
      )}
      {cap && (
        <>
          <path d="M33 21 H69 V30 C60 27 42 27 33 30 Z" fill={K} {...STROKE} />
          <path d="M51 3 L90 15 L51 27 L12 15 Z" fill={K} {...STROKE} />
          <path d="M51 15 L81 19 L81 33" fill="none" stroke={YELLOW} strokeWidth="2.8" strokeLinecap="round" />
          <path d={starPath(81, 37, 5)} fill={YELLOW} {...STROKE} strokeWidth={1.4} />
        </>
      )}
    </g>
  )
}

const Shadow = () => <ellipse cx="50" cy="97.5" rx="24" ry="2.6" fill="rgb(0 0 0 / 13%)" />
const Legs = () => (
  <g {...STROKE}>
    <rect x="40" y="86" width="8" height="7" rx="2" fill={K} />
    <rect x="53" y="86" width="8" height="7" rx="2" fill={K} />
    <path d="M35 96.5 C35 91 39 90.5 44.5 91.5 C48.5 92.5 48 96.5 44 96.5 Z" fill="#fff" />
    <path d="M66 96.5 C66 91 62 90.5 56.5 91.5 C52.5 92.5 53 96.5 57 96.5 Z" fill="#fff" />
  </g>
)
const Torso = ({ top }) => (
  <>
    <path d="M31 89 C29 74 38 64 50.5 64 C63 64 72 74 70 89 Z" fill={top} {...STROKE} />
    <path d="M42.5 66 Q50.5 72 58.5 66" fill="none" stroke={darkColor(top) ? '#fff' : K} strokeWidth="2.4" strokeLinecap="round" />
  </>
)
// 책 읽는 다니(로고): 큰 머리가 펼친 책 너머로 빼꼼 보이고, 책이 얼굴 아래를 가린다.
// 왼쪽 볼 옆으로 말려 내려온 잔머리, 앞머리 끝이 얼굴로 뾰족하게 들어온 모양이 포인트.
function BookDani({ colors, mood }) {
  const { hair } = colors
  return (
    <>
      {/* 움직임 선 세 개 */}
      <g stroke={K} strokeWidth="4.2" strokeLinecap="round">
        <path d="M14 14.5 L19.5 20.5" />
        <path d="M25.5 7.5 L28 16" />
        <path d="M7 28.5 L15 30" />
      </g>
      {/* 올림머리와 뒷머리 */}
      <circle cx="75.5" cy="18" r="12.5" fill={hair} {...STROKE} />
      <path
        d="M26.5 60 C20.5 50 21 38 27.5 29 C34.5 21 43.5 16.5 52.5 15.5 C59 15 64 15.5 67 17 C77 21 85 29 88 41 C90.5 51 88.5 61 82 69 L30 69 Z"
        fill={hair}
        {...STROKE}
      />
      {/* 얼굴: 가르마 끝에서 왼쪽 앞머리가 둥글게 내려오고, 오른쪽 앞머리는 비스듬히 넘어간다. 아래는 책에 가려진다 */}
      <path
        d="M49.5 25 C48 30.5 44.5 34.5 40 37.5 C37 39.5 34.5 41.5 33 44.5 C31.5 48 31 53 31 58 L30.5 72 L79 72 L79.5 63 C75 57 68 51.5 62 46 C56 40.5 51.8 33.5 49.5 25 Z"
        fill="#fff"
        {...STROKE}
      />
      {/* 잔머리: 얼굴 왼쪽을 따라 내려오다 끝이 머리 바깥으로 살짝 말려 나온다 */}
      <path
        d="M33.5 40.5 C29 45.5 27.6 51.5 29.2 57 C27.4 61.6 22.6 64.6 17.6 63.6 C21.2 61.2 23 57.6 22.8 52.6 C22.6 46.6 25.8 40.6 30.8 36.2 Z"
        fill={hair}
        {...STROKE}
      />
      {/* 눈 */}
      {mood === 'dot' ? (
        <>
          <rect x="43.4" y="50" width="4" height="9" rx="2" fill={K} transform="rotate(4 45.4 54.5)" />
          <rect x="55.6" y="50" width="4" height="9" rx="2" fill={K} transform="rotate(4 57.6 54.5)" />
        </>
      ) : (
        <g transform="translate(-0.5 4)">
          <Eyes mood={mood} />
        </g>
      )}
      {/* 펼친 책(얼굴 아래를 가린다) */}
      <path
        d="M19.5 63 C30 59.5 40 61.5 47.7 69.5 C56 63.5 67 62.5 79.5 65 L80 73 L74 89.5 C65 88 55.5 89.5 47.7 93.5 C40 89.5 30.5 88 22.5 89 L21 73 Z"
        fill={K}
        {...STROKE}
      />
      <path
        d="M22.5 65 C31.5 62.5 40.5 64.5 47.7 71.5 C55.5 65.8 66.5 65 77.5 66.8 L77.5 69 C66.5 67.2 56 68.2 47.7 74.5 C40.5 67.5 31.5 65.4 22.5 67.4 Z"
        fill="#fff"
        stroke={K}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d={starPath(62.5, 79, 6)} fill={YELLOW} />
      {/* 책을 잡은 손 */}
      <Hand x={21} y={82.5} r={7.6} />
      <Hand x={79} y={82.5} r={7.6} />
    </>
  )
}

function Pose({ pose, mood, colors, clipId }) {
  switch (pose) {
    case 'peek':
      return (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width="100" height="82" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <Head colors={colors} cy={66} mood={mood} />
          </g>
          <path d="M8 82 H92" stroke={K} strokeWidth="3.4" strokeLinecap="round" />
          <Mark x={80} y={42}>?</Mark>
        </>
      )
    case 'book':
      return <BookDani colors={colors} mood={mood} />

    case 'chat':
      return (
        <>
          <Head colors={colors} cy={41} mood={mood} phones />
          <rect x="25" y="68" width="51" height="25" rx="4" fill="#e3e3e3" {...STROKE} />
          <path d={starPath(50.5, 80.5, 6)} fill={YELLOW} {...STROKE} strokeWidth={1.4} />
          <path d="M17 93 H84 L80 98 H21 Z" fill="#cfcfcf" {...STROKE} />
          <Hand x={23} y={90} r={6.5} />
          <Hand x={78} y={90} r={6.5} />
        </>
      )
    case 'cheer':
      return (
        <>
          <Shadow />
          <Legs />
          <Arm d="M65 72 C71 65 75 57 77 49" top={colors.top} />
          <Torso top={colors.top} />
          <Arm d="M36 72 C30 75 29 81 31 84" top={colors.top} />
          <Hand x={31} y={85} r={5.5} />
          <Hand x={78} y={46} />
          <Head colors={colors} cy={36} mood={mood === 'dot' ? 'joy' : mood} phones />
          <Sparkle x={90} y={30} r={5.5} />
          <Sparkle x={11} y={64} r={4} />
          <Pop x={4} y={20} s={0.9} />
        </>
      )
    case 'doctor':
      return (
        <>
          <Shadow />
          <Legs />
          <Torso top={colors.top} />
          <Head colors={colors} cy={36} mood={mood === 'dot' ? 'joy' : mood} cap />
          <rect x="26" y="74" width="49" height="10" rx="5" fill="#fff6dc" {...STROKE} />
          <path d="M50.5 74 V84" stroke="#e2574c" strokeWidth="3.6" />
          <Hand x={27} y={79} />
          <Hand x={74} y={79} />
          <Sparkle x={90} y={56} r={5.5} />
          <Sparkle x={10} y={46} r={4.5} />
        </>
      )
    default:
      return (
        <>
          <Head colors={colors} cy={48} mood={mood === 'curious' ? 'dot' : mood} />
          {mood === 'joy' && (
            <>
              <Sparkle x={88} y={34} r={5.5} />
              <Sparkle x={12} y={74} r={4} />
            </>
          )}
          {mood === 'curious' && <Mark x={84} y={38}>?</Mark>}
          {mood === 'sleepy' && (
            <>
              <Mark x={83} y={34} size={14}>Z</Mark>
              <Mark x={91} y={23} size={10}>z</Mark>
            </>
          )}
          {mood === 'cool' && <Pop x={6} y={26} />}
        </>
      )
  }
}

export const DANI_POSES = ['peek', 'book', 'chat', 'cheer', 'doctor']

export default function Dani({ pose = 'face', mood = 'dot', colors = DEFAULT_DANI, size = 96, className = 'dani' }) {
  const clipId = useId().replace(/:/g, '')
  return (
    <svg className={className} aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      <Pose pose={pose} mood={mood} colors={{ ...DEFAULT_DANI, ...colors }} clipId={clipId} />
    </svg>
  )
}
