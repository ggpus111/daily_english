// Pro의 AI 대화 도우미가 서버 함수로 보내는 요청문. 외국인 연인·친구와 메시지로 대화하는 사람에게 맞춘다:
// 교과서 말이 아니라 채팅 앱과 온라인 커뮤니티에서 실제로 쓰는 말을 기준으로 한다.
// 답은 화면에 그대로 보여 주므로(줄바꿈 유지), 마크다운 기호 없이 번호와 줄바꿈으로만 나누게 한다.

export const MAX_HELPER_TEXT = 1500
const MAX_REPORT_CHARS = 9000
const WEEK_DAYS = 7

const plain = 'Do not use Markdown symbols such as *, #, or backticks. Use numbers and line breaks only.'

/** 보내기 전 메시지 다듬기: 보내려는 말을 자연스러운 말투 세 가지로. */
export function buildPolishPrompt({ learning, explain, text }) {
  return [
    `You help someone who chats with a foreign partner or friend in ${learning}.`,
    `Rewrite the message below into natural, casual ${learning} that people really use in chat apps and online communities, not textbook language.`,
    `The message may be written in ${explain}, in rough ${learning}, or a mix of both.`,
    'Give exactly 3 versions:',
    '1) warm and sweet',
    '2) playful',
    '3) simple and neutral',
    `For each version, write the ${learning} message on one line, then one short line in ${explain} explaining its nuance.`,
    `Finish with one line in ${explain} starting with "Tip:" about a word or expression worth remembering.`,
    `Write every explanation in ${explain}.`,
    plain,
    '',
    'Message:',
    '"""',
    text.trim().slice(0, MAX_HELPER_TEXT),
    '"""',
  ].join('\n')
}

/** 받은 메시지 풀이: 상대 메시지의 뜻, 슬랭·줄임말, 말투, 답장 예시. */
export function buildExplainPrompt({ learning, explain, text }) {
  return [
    `Below is a message someone received from a foreign partner or friend. It is written in ${learning} the way people really write in chat apps and online communities.`,
    `Explain it in ${explain}:`,
    `1) The overall meaning, translated naturally into ${explain}.`,
    '2) Each piece of slang, abbreviation, or unusual spelling, one per line as: original - meaning. Write "none" if there are none.',
    '3) The mood and intent (for example teasing, upset, affectionate, joking).',
    `4) Two natural replies in ${learning}, each followed by its meaning in ${explain}.`,
    plain,
    '',
    'Message:',
    '"""',
    text.trim().slice(0, MAX_HELPER_TEXT),
    '"""',
  ].join('\n')
}

/** 이번 주(오늘 포함 7일) 일기. 번역이 있는 것만, 오래된 것부터. */
export function weekJournals(journals, today = new Date()) {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (WEEK_DAYS - 1))
  return journals
    .filter((item) => item.translation?.trim() && new Date(item.createdAt) >= start)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** 주간 AI 리포트: 이번 주 일기와 받은 교정을 모아 자주 틀린 점과 다음 주 연습할 표현을 정리한다. */
export function buildWeeklyReportPrompt({ learning, explain, journals }) {
  const blocks = []
  let used = 0
  for (const [index, item] of journals.entries()) {
    const block = [
      `Entry ${index + 1}`,
      `What I wanted to say (${explain}): ${item.native.trim()}`,
      `My ${learning}: ${item.translation.trim()}`,
      item.aiFeedback?.trim() ? `Correction I received:\n${item.aiFeedback.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    if (used + block.length > MAX_REPORT_CHARS) break
    blocks.push(block)
    used += block.length
  }
  return [
    `You are a friendly ${learning} coach for someone who chats with a foreign partner or friend.`,
    `Below are this week's diary entries: what they wanted to say, how they wrote it in ${learning}, and the corrections they got.`,
    `Write a short weekly report in ${explain}:`,
    '1) The 3 mistakes they made most often, each with a wrong example and the natural version.',
    '2) Expressions they used well this week.',
    `3) 3 natural, casual ${learning} expressions to try next week that fit the topics they write about, each with its meaning.`,
    '4) One line of encouragement.',
    plain,
    '',
    blocks.join('\n\n'),
  ].join('\n')
}
