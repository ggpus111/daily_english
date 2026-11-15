// 일기에 고르는 오늘의 기분. 단어 꾸러미에 넣은 기분 낱말에서 골랐고(analysis/native/README.md),
// 고르면 그 낱말을 쓴 짧은 예문을 보여 줘서 기분 고르기가 곧 단어 공부가 되게 한다.
export const MOODS = [
  { id: 'happy', ko: '행복한', sentence: 'I was really happy today.', sentenceKo: '오늘 정말 행복했어.' },
  { id: 'excited', ko: '신이 난', sentence: 'I was so excited today.', sentenceKo: '오늘 너무 신났어.' },
  { id: 'proud', ko: '뿌듯한', sentence: 'I was proud of myself today.', sentenceKo: '오늘 내가 뿌듯했어.' },
  { id: 'calm', ko: '차분한', sentence: 'I felt calm today.', sentenceKo: '오늘은 마음이 차분했어.' },
  { id: 'comfortable', ko: '편안한', sentence: 'I felt comfortable at home today.', sentenceKo: '오늘은 집에서 편안했어.' },
  { id: 'busy', ko: '바쁜', sentence: 'I was busy all day.', sentenceKo: '하루 종일 바빴어.' },
  { id: 'tired', ko: '피곤한', sentence: 'I was so tired today.', sentenceKo: '오늘 너무 피곤했어.' },
  { id: 'bored', ko: '심심한', sentence: 'I was bored at home today.', sentenceKo: '오늘 집에서 심심했어.' },
  { id: 'nervous', ko: '긴장한', sentence: 'I was nervous before the test.', sentenceKo: '시험 전에 긴장했어.' },
  { id: 'sad', ko: '슬픈', sentence: 'I felt a little sad today.', sentenceKo: '오늘 조금 슬펐어.' },
  { id: 'upset', ko: '속상한', sentence: 'I was upset about something today.', sentenceKo: '오늘 어떤 일 때문에 속상했어.' },
  { id: 'angry', ko: '화난', sentence: 'I got angry today.', sentenceKo: '오늘 화가 났어.' },
]

export const MOOD_IDS = MOODS.map((mood) => mood.id)

// 요일 도장 색: 기분이 좋은 날(good), 힘든 날(low), 그 밖(plain)
const GOOD = new Set(['happy', 'excited', 'proud', 'calm', 'comfortable'])
const LOW = new Set(['tired', 'bored', 'nervous', 'sad', 'upset', 'angry'])
export const moodTone = (id) => (GOOD.has(id) ? 'good' : LOW.has(id) ? 'low' : 'plain')

export const moodOf = (id) => MOODS.find((mood) => mood.id === id) ?? null

/** 기분 낱말을 단어장에 넣을 기록으로 바꾼다. */
export const moodToWord = (mood) => ({ text: mood.id, meaning: mood.ko, example: mood.sentence })
