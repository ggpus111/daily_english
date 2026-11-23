// 문법 노트 연습: 담아 둔 문법(예: used to + 동사원형)으로 번역하거나 직접 문장을 써 보고,
// 로그인했으면 앱 안 AI(supabase/functions/correct-journal)에게 맞게 썼는지 확인받는다.
// 요청문은 일기 교정(correction.js)처럼 역할·지킬 점·답 형식을 두고, 정해진 제목으로만 답하게 해서 앱이 나눠 보여 준다.

export const PRACTICE_MODES = ['translate', 'compose']

/** 이 문법으로 할 수 있는 연습. 예문과 해석이 둘 다 있어야 번역 연습을 낸다. */
export const modesFor = (note) =>
  PRACTICE_MODES.filter((mode) => mode === 'compose' || (note.example?.trim() && note.exampleNative?.trim()))

const COPY = {
  ko: {
    headings: { verdict: '결과', corrected: '고친 문장', why: '설명' },
    ok: '맞았어요',
    fix: '고칠 점 있어요',
    role: ({ learning, explain }) => `[역할]\n당신은 ${explain}로 설명해 주는 다정한 ${learning} 문법 튜터예요.`,
    task: {
      translate: ({ source }) =>
        `[할 일]\n아래 우리말을 [문법]을 써서 옮긴 제 문장을 확인해 주세요.\n우리말: ${source}`,
      compose: () => '[할 일]\n[문법]을 써서 제가 직접 지은 문장을 확인해 주세요.',
    },
    rules: [
      '[지켜 주세요]',
      '- 문법을 맞게 썼는지, 뜻이 자연스러운지 봐 주세요. 제 표현은 최대한 살려 주세요.',
      '- 아래 [답 형식]의 제목 3개를 그대로, 이 순서대로만 써 주세요.',
      '- 결과에는 "맞았어요"나 "고칠 점 있어요" 중 하나만 쓰세요.',
      '- 맞았으면 고친 문장에 제 문장을 그대로 쓰고, 설명에는 잘한 점을 한 줄로 써 주세요.',
    ],
    formatTitle: '[답 형식]',
    grammarTitle: '[문법]',
    answerTitle: '[내 문장]',
  },
  en: {
    headings: { verdict: 'Result', corrected: 'Corrected sentence', why: 'Explanation' },
    ok: 'Correct',
    fix: 'Needs a fix',
    role: ({ learning, explain }) => `[Role]\nYou are a kind ${learning} grammar tutor who explains in ${explain}.`,
    task: {
      translate: ({ source }) =>
        `[Task]\nCheck my sentence, which translates the text below using [Grammar].\nText: ${source}`,
      compose: () => '[Task]\nCheck the sentence I wrote myself using [Grammar].',
    },
    rules: [
      '[Rules]',
      '- Check that the grammar is used correctly and the sentence sounds natural. Keep my wording where you can.',
      '- Use exactly the three headings in [Answer format], in that order.',
      '- Under Result, write only "Correct" or "Needs a fix".',
      '- If it is correct, repeat my sentence under Corrected sentence and say what went well in one line.',
    ],
    formatTitle: '[Answer format]',
    grammarTitle: '[Grammar]',
    answerTitle: '[My sentence]',
  },
}

const copyFor = (uiLang) => (uiLang === 'ko' ? COPY.ko : COPY.en)

/**
 * 문법 연습 확인 요청문.
 * @param {{ uiLang: string, learning: string, explain: string, note: { text: string, meaning: string }, mode: 'translate'|'compose', source?: string, answer: string }} input
 */
export function buildGrammarCheckPrompt({ uiLang, learning, explain, note, mode, source = '', answer }) {
  const c = copyFor(uiLang)
  const h = c.headings
  return [
    c.role({ learning, explain }),
    c.task[mode]({ source }),
    c.rules.join('\n'),
    [c.formatTitle, `## ${h.verdict}`, `## ${h.corrected}`, `## ${h.why}`].join('\n'),
    `${c.grammarTitle}\n${note.text}: ${note.meaning}`,
    `${c.answerTitle}\n${answer}`,
  ].join('\n\n')
}

const HEADING_TO_KEY = new Map(
  Object.values(COPY).flatMap((c) => Object.entries(c.headings).map(([key, label]) => [label.toLowerCase(), key])),
)
const OK_WORDS = Object.values(COPY).map((c) => c.ok.toLowerCase())

/**
 * AI 답을 { ok, corrected, why }로 나눈다. 정해진 제목이 없으면 null(받은 글을 그대로 보여 준다).
 */
export function parseGrammarCheck(text) {
  if (!text) return null
  const sections = {}
  let current = null
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^\s*#{1,6}\s*(?:\*\*)?\s*(.+?)\s*(?:\*\*)?\s*:?\s*$/)
    const key = heading && HEADING_TO_KEY.get(heading[1].toLowerCase())
    if (key) {
      current = key
      sections[key] = []
    } else if (current) {
      sections[current].push(line)
    }
  }
  if (!sections.verdict) return null
  const joined = (key) => (sections[key] ?? []).join('\n').replace(/\*\*/g, '').trim()
  const verdict = joined('verdict').toLowerCase()
  return { ok: OK_WORDS.some((word) => verdict.startsWith(word)), corrected: joined('corrected'), why: joined('why') }
}
