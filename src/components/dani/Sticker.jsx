import Dani from '../Dani'

// 친구 문장에 보내는 다니 이모티콘. 종류(kind)는 couple_reactions.kind와 같다(src/lib/couple.js REACTIONS).
// 이모티콘 글자는 친구끼리 실제로 쓰는 짧은 영어이고, 뜻은 화면 읽기 프로그램용으로 따로 읽어 준다.
export const STICKERS = {
  heart: { pose: 'face', mood: 'joy', word: 'love it' },
  thanks: { pose: 'face', mood: 'dot', word: 'thank u' },
  funny: { pose: 'cheer', mood: 'joy', word: 'LOL' },
  learned: { pose: 'book', mood: 'dot', word: 'learned it' },
  bet: { pose: 'face', mood: 'cool', word: 'bet!' },
  wdym: { pose: 'face', mood: 'curious', word: 'wdym?' },
  night: { pose: 'face', mood: 'sleepy', word: 'nighty night' },
  talk: { pose: 'chat', mood: 'dot', word: "let's talk" },
}

export default function Sticker({ kind, size = 56, colors }) {
  const sticker = STICKERS[kind]
  if (!sticker) return null
  return (
    <span className="dani-sticker">
      <Dani pose={sticker.pose} mood={sticker.mood} colors={colors} size={size} />
      <b lang="en">{sticker.word}</b>
    </span>
  )
}
