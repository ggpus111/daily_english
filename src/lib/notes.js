import { local } from './storage'

// 말새가 홈에서 들려주는 한마디. 영어 문장과 우리말 풀이를 함께 둔다.
// 홈을 열 때마다 바뀐다(바로 앞에 본 것은 다시 나오지 않는다).
export const NOTES = [
  {
    en: 'You don’t have to be perfect. Just keep showing up.',
    ko: '완벽하지 않아도 괜찮아. 꾸준히 돌아오는 게 중요해.',
  },
  { en: 'Small steps every day add up.', ko: '매일의 작은 걸음이 쌓여요.' },
  { en: 'One new word is still progress.', ko: '새 단어 하나도 분명한 한 걸음이에요.' },
  { en: 'Mistakes are proof that you are trying.', ko: '틀렸다는 건 해 보고 있다는 뜻이에요.' },
  { en: 'Rest is part of learning, too.', ko: '쉬는 것도 배우는 과정이에요.' },
  { en: 'The words you collect become your voice.', ko: '모은 말들이 결국 내 목소리가 돼요.' },
  { en: 'Slow is fine. Stopping for good is the only miss.', ko: '느려도 괜찮아요. 아주 멈추지만 않으면 돼요.' },
  {
    en: 'A short message in their language says “I care.”',
    ko: '상대의 말로 보낸 짧은 한마디는 “마음 쓰고 있어”라는 뜻이 돼요.',
  },
  { en: 'Say it simply. Simple is easy to feel.', ko: '쉽게 말해도 돼요. 쉬운 말이 마음에 더 잘 닿아요.' },
  { en: 'Your accent is part of your story.', ko: '내 억양도 내 이야기의 일부예요.' },
  { en: 'Today’s clumsy sentence is next month’s easy one.', ko: '오늘 어설픈 문장이 다음 달엔 쉬운 문장이 돼요.' },
  { en: 'Say “I miss you” out loud once today.', ko: '오늘 “보고 싶어”를 소리 내어 한 번 말해 봐요.' },
  { en: 'You learn the most from the words you actually use.', ko: '진짜로 써 본 말이 제일 오래 남아요.' },
  { en: 'Even one sentence today keeps the habit alive.', ko: '오늘 한 문장만 써도 습관은 이어져요.' },
  { en: 'Funny mistakes make the best memories.', ko: '웃긴 실수가 제일 오래 기억에 남아요.' },
  { en: 'It’s okay to ask “What does that mean?”', ko: '“그게 무슨 뜻이야?” 하고 물어봐도 괜찮아요.' },
  { en: 'Good conversations start with a small hello.', ko: '좋은 대화는 작은 인사에서 시작해요.' },
  { en: 'Be kind to yourself while you learn.', ko: '배우는 동안엔 나한테도 다정하게 대해 줘요.' },
]

const LAST_NOTE_KEY = 'lastNoteIndex'

/**
 * 한마디를 하나 고른다. lastIndex와 같은 것은 피한다(길이가 2 이상일 때).
 * random은 0 이상 1 미만 숫자를 돌려주는 함수라서 테스트에서 바꿔 넣을 수 있다.
 */
export function pickNoteIndex(length, lastIndex, random = Math.random) {
  if (length <= 1) return 0
  const skip = Number.isInteger(lastIndex) && lastIndex >= 0 && lastIndex < length
  const pool = length - (skip ? 1 : 0)
  const roll = Math.min(pool - 1, Math.floor(random() * pool))
  return skip && roll >= lastIndex ? roll + 1 : roll
}

/** 홈을 열 때 부른다. 바로 앞에 본 한마디는 피하고, 이번에 본 것을 기억해 둔다. */
export function pickNote() {
  const last = Number(local.get(LAST_NOTE_KEY))
  const index = pickNoteIndex(NOTES.length, Number.isFinite(last) ? last : -1)
  local.set(LAST_NOTE_KEY, String(index))
  return NOTES[index]
}
