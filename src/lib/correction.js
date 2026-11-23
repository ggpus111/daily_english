// 앱 안 AI 교정(supabase/functions/correct-journal)에 보낼 일기 교정 요청문을 만들고, 받은 답을 제목별로 나눈다.
//
// 요청문 맨 위에 역할·지킬 점·답 형식을 두고(시스템 프롬프트 역할), 사용자 기록을 그때그때 넣고(동적 컨텍스트),
// 모범 답 하나를 보여 주고(Few-Shot), 정해진 제목으로만 답하게 해서(출력 고정)
// 앱이 답을 다시 나눠 보여 줄 수 있게 한다.

const SECTION_KEYS = ['corrected', 'fixes', 'natural', 'grammar', 'good', 'practice']

const COPY = {
  ko: {
    headings: {
      corrected: '고친 문장',
      fixes: '고칠 점',
      natural: '더 자연스러운 표현',
      grammar: '문법 포인트',
      good: '잘한 점',
      practice: '연습할 점',
    },
    fix: { original: '원래', fixed: '고침', reason: '이유', none: '없음' },
    grammarLabels: { text: '문법', meaning: '설명', example: '예문', exampleNative: '해석' },
    role: ({ learning, explain }) => `[역할]\n당신은 ${explain}로 설명해 주는 다정한 ${learning} 튜터예요.`,
    rules: ({ learning, explain }) => [
      '[지켜 주세요]',
      '- 제 표현과 수준을 최대한 살리고, 꼭 필요한 곳만 고쳐 주세요.',
      '- 일기와 뜻이 달라진 부분이 있으면 고칠 점에 꼭 넣어 주세요.',
      `- 설명은 ${explain}로, 고친 문장은 ${learning}로 써 주세요.`,
      '- 아래 [답 형식]의 제목 6개를 그대로, 이 순서대로만 써 주세요. 인사말이나 다른 제목은 붙이지 마세요.',
      '- 고칠 점은 한 줄에 하나씩 "- 원래: … → 고침: … | 이유: …" 모양으로 써 주세요. 고칠 게 없으면 "- 없음"이라고 써 주세요.',
      `- 더 자연스러운 표현에는 같은 뜻을 원어민이 일상에서 더 자연스럽게 말하는 ${learning} 표현을 1~3개, 한 줄에 하나씩 "- 표현 | 언제 쓰는지" 모양으로 써 주세요. 슬랭은 욕이 아닌 것만 쓰고, 격식 있는 자리에서 쓰면 안 되는 표현이면 그렇게 적어 주세요.`,
      '- 문법 포인트에는 제가 틀리거나 헷갈린 문법을 0~2개, 한 줄에 하나씩 "- 문법: … | 설명: … | 예문: … | 해석: …" 모양으로 써 주세요(예: 문법: used to + 동사원형). 예문은 새로 지은 짧은 문장, 해석은 그 예문의 우리말 뜻이에요. 없으면 "- 없음"이라고 써 주세요.',
    ],
    formatTitle: '[답 형식]',
    exampleTitle: '[답 예시] 형식만 참고하고 내용은 따라 하지 마세요.',
    example: {
      native: '오늘 친구랑 카페에 갔다.',
      translation: 'Today I go to cafe with friend.',
      corrected: 'Today I went to a cafe with my friend.',
      fixes: [
        ['go', 'went', '이미 한 일이라 과거형을 써요.'],
        ['cafe', 'a cafe', '셀 수 있는 명사 하나 앞에는 a를 붙여요.'],
        ['with friend', 'with my friend', '누구의 친구인지 my를 붙이면 자연스러워요.'],
      ],
      natural: [
        ['I hung out at a cafe with my friend.', "hang out은 '같이 시간을 보내다'라서 친구와 갈 때 더 일상적이에요."],
        ['My friend and I grabbed coffee.', '카페에서 커피 마신 일을 가볍게 말할 때 써요.'],
      ],
      grammar: [
        [
          '과거형(지난 일)',
          '이미 한 일은 동사를 과거형으로 써요.',
          'I watched a movie yesterday.',
          '나는 어제 영화를 봤다.',
        ],
      ],
      good: '하고 싶은 말을 짧고 분명하게 전했어요.',
      practice: '지난 일을 쓸 때 동사를 과거형으로 바꾸는 연습을 해 보세요.',
    },
    exampleLabels: { native: '일기', translation: '번역' },
    practiceTitle: '[참고: 지난 교정에서 연습하기로 한 점]',
    practiceHint: '이번 번역에서 이 점을 잘 지켰다면 잘한 점에서 짚어 주세요.',
    wordsTitle: '[참고: 최근 모은 단어]',
    wordsHint: '자연스럽게 어울릴 때만 고친 문장에 써 주세요. 억지로 넣지 마세요.',
    nativeTitle: '[일기]',
    translationTitle: '[내 번역]',
  },
  en: {
    headings: {
      corrected: 'Corrected translation',
      fixes: 'Fixes',
      natural: 'More natural ways',
      grammar: 'Grammar points',
      good: 'What went well',
      practice: 'Practice next',
    },
    fix: { original: 'Original', fixed: 'Fix', reason: 'Why', none: 'None' },
    grammarLabels: { text: 'Grammar', meaning: 'Meaning', example: 'Example', exampleNative: 'Translation' },
    role: ({ learning, explain }) => `[Role]\nYou are a kind ${learning} tutor who explains in ${explain}.`,
    rules: ({ learning, explain }) => [
      '[Rules]',
      '- Keep my wording and level as much as you can, and change only what is needed.',
      '- If any part means something different from the diary, include it under Fixes.',
      `- Write explanations in ${explain} and the corrected translation in ${learning}.`,
      '- Use exactly the six headings in [Answer format], in that order. Do not add greetings or other headings.',
      '- Put one fix per line as "- Original: … → Fix: … | Why: …". If there is nothing to fix, write "- None".',
      `- Under More natural ways, give 1 to 3 ${learning} expressions a native speaker would use in everyday speech for the same meaning, one per line as "- Expression | When to use it". Slang is fine but no profanity, and say so if an expression is not for formal situations.`,
      '- Under Grammar points, list 0 to 2 grammar points I got wrong or mixed up, one per line as "- Grammar: … | Meaning: … | Example: … | Translation: …" (e.g. Grammar: used to + base verb). The example is a new short sentence and the translation is its meaning in my native language. If there are none, write "- None".',
    ],
    formatTitle: '[Answer format]',
    exampleTitle: '[Example answer] Follow the format only, not the content.',
    example: {
      native: 'Today I went to a cafe with a friend. (in my native language)',
      translation: 'Today I go to cafe with friend.',
      corrected: 'Today I went to a cafe with my friend.',
      fixes: [
        ['go', 'went', 'It already happened, so use the past tense.'],
        ['cafe', 'a cafe', 'Use "a" before a single countable noun.'],
        ['with friend', 'with my friend', 'Adding "my" sounds natural here.'],
      ],
      natural: [
        [
          'I hung out at a cafe with my friend.',
          '"Hang out" means spending time together, so it is more everyday here.',
        ],
        ['My friend and I grabbed coffee.', 'A casual way to say you had coffee at a cafe.'],
      ],
      grammar: [
        [
          'Past tense',
          'Use the past tense for things that already happened.',
          'I watched a movie yesterday.',
          'I watched a movie yesterday. (in my native language)',
        ],
      ],
      good: 'You said what you wanted to say clearly and briefly.',
      practice: 'When writing about the past, practise changing verbs to the past tense.',
    },
    exampleLabels: { native: 'Diary', translation: 'Translation' },
    practiceTitle: '[Context: what I planned to practise last time]',
    practiceHint: 'If I did well on this in this translation, mention it under What went well.',
    wordsTitle: '[Context: words I saved recently]',
    wordsHint: 'Use them in the corrected translation only if they fit naturally. Do not force them in.',
    nativeTitle: '[Diary]',
    translationTitle: '[My translation]',
  },
}

const copyFor = (uiLang) => (uiLang === 'ko' ? COPY.ko : COPY.en)

const GRAMMAR_FIELDS = ['text', 'meaning', 'example', 'exampleNative']
const grammarLine = (labels, values) =>
  `- ${GRAMMAR_FIELDS.map((field, index) => `${labels[field]}: ${values[index]}`).join(' | ')}`

const fixLine = (fix, [original, fixed, reason]) =>
  `- ${fix.original}: ${original} → ${fix.fixed}: ${fixed} | ${fix.reason}: ${reason}`

/**
 * 교정 요청문을 만든다.
 * @param {object} input
 * @param {string} input.uiLang 앱 화면 언어('ko' 또는 'en')
 * @param {string} input.learning 학습 언어 이름
 * @param {string} input.explain 설명 언어 이름
 * @param {string} input.native 모국어 일기
 * @param {string} input.translation 직접 한 번역
 * @param {string[]} [input.practiceNotes] 지난 교정의 "연습할 점"
 * @param {string[]} [input.recentWords] 최근 저장한 단어
 */
export function buildCorrectionPrompt({
  uiLang,
  learning,
  explain,
  native,
  translation,
  practiceNotes = [],
  recentWords = [],
}) {
  const c = copyFor(uiLang)
  const h = c.headings
  const ex = c.example
  const blocks = [
    c.role({ learning, explain }),
    c.rules({ learning, explain }).join('\n'),
    [c.formatTitle, ...SECTION_KEYS.map((key) => `## ${h[key]}`)].join('\n'),
    [
      c.exampleTitle,
      `${c.exampleLabels.native}: ${ex.native}`,
      `${c.exampleLabels.translation}: ${ex.translation}`,
      '',
      `## ${h.corrected}`,
      ex.corrected,
      '',
      `## ${h.fixes}`,
      ...ex.fixes.map((item) => fixLine(c.fix, item)),
      '',
      `## ${h.natural}`,
      ...ex.natural.map(([expression, note]) => `- ${expression} | ${note}`),
      '',
      `## ${h.grammar}`,
      ...ex.grammar.map((values) => grammarLine(c.grammarLabels, values)),
      '',
      `## ${h.good}`,
      ex.good,
      '',
      `## ${h.practice}`,
      ex.practice,
    ].join('\n'),
  ]
  if (practiceNotes.length > 0) {
    blocks.push([c.practiceTitle, ...practiceNotes.map((note) => `- ${note}`), c.practiceHint].join('\n'))
  }
  if (recentWords.length > 0) {
    blocks.push([c.wordsTitle, recentWords.join(', '), c.wordsHint].join('\n'))
  }
  blocks.push(`${c.nativeTitle}\n${native}`, `${c.translationTitle}\n${translation}`)
  return blocks.join('\n\n')
}

// 두 언어의 제목을 모두 알아본다. AI가 굵게(**), 번호(1.), 콜론을 붙여도 받아 준다.
const HEADING_TO_KEY = new Map(
  Object.values(COPY).flatMap((c) => SECTION_KEYS.map((key) => [c.headings[key].toLowerCase(), key])),
)
const HEADING_LINE = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:\d+[.)]\s*)?(.+?)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*$/
const NONE_WORDS = new Set(Object.values(COPY).map((c) => c.fix.none.toLowerCase()))

const FIX_PATTERNS = Object.values(COPY).map(
  ({ fix }) =>
    new RegExp(
      `^${fix.original}\\s*:\\s*(.+?)\\s*(?:→|->|=>)\\s*${fix.fixed}\\s*:\\s*(.+?)\\s*(?:\\|\\s*${fix.reason}\\s*:\\s*(.+))?$`,
      'i',
    ),
)

const clean = (text) => text.replace(/\*\*/g, '').trim()

function headingKey(line) {
  const match = line.match(HEADING_LINE)
  if (!match) return null
  return HEADING_TO_KEY.get(clean(match[1]).toLowerCase()) ?? null
}

function parseFix(line) {
  const text = clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''))
  if (!text || NONE_WORDS.has(text.toLowerCase())) return null
  for (const pattern of FIX_PATTERNS) {
    const match = text.match(pattern)
    if (match) return { original: match[1], fixed: match[2], reason: match[3] ?? '' }
  }
  return { text }
}

// "- 표현 | 언제 쓰는지" 한 줄을 { text, note }로 나눈다. "|"가 없으면 표현만 남긴다.
function parseNatural(line) {
  const text = clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''))
  if (!text || NONE_WORDS.has(text.toLowerCase())) return null
  const [expression, ...rest] = text.split('|')
  const note = rest.join('|').trim()
  return { text: expression.trim(), note }
}

// "- 문법: … | 설명: … | 예문: … | 해석: …" 한 줄을 문법 노트 모양으로 나눈다. 문법과 설명이 있어야 담을 수 있다.
const GRAMMAR_LABELS = new Map(
  Object.values(COPY).flatMap((c) => GRAMMAR_FIELDS.map((field) => [c.grammarLabels[field].toLowerCase(), field])),
)
function parseGrammar(line) {
  const text = clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''))
  if (!text || NONE_WORDS.has(text.toLowerCase())) return null
  const note = {}
  for (const part of text.split('|')) {
    const match = part.match(/^\s*([^:：]+?)\s*[:：]\s*(.+?)\s*$/)
    const field = match && GRAMMAR_LABELS.get(match[1].toLowerCase())
    if (field) note[field] = match[2]
  }
  return note.text && note.meaning ? { example: '', exampleNative: '', ...note } : null
}

/**
 * 붙여 넣은 교정을 제목별로 나눈다. 정해진 형식이 아니면 null을 돌려준다.
 * @returns {{ corrected: string, fixes: Array<{original?: string, fixed?: string, reason?: string, text?: string}>, natural: Array<{text: string, note: string}>, good: string, practice: string } | null}
 */
export function parseFeedback(text) {
  if (!text) return null
  const sections = {}
  let current = null
  for (const line of text.split(/\r?\n/)) {
    const key = headingKey(line)
    if (key) {
      current = key
      sections[key] = []
    } else if (current) {
      sections[current].push(line)
    }
  }
  // 고친 문장과 다른 제목 하나 이상이 있어야 형식을 지킨 답으로 본다.
  const found = SECTION_KEYS.filter((key) => sections[key])
  if (!sections.corrected || found.length < 2) return null

  const joined = (key) => clean((sections[key] ?? []).join('\n'))
  return {
    corrected: joined('corrected'),
    fixes: (sections.fixes ?? []).map(parseFix).filter(Boolean),
    natural: (sections.natural ?? []).map(parseNatural).filter(Boolean),
    grammar: (sections.grammar ?? []).map(parseGrammar).filter(Boolean),
    good: joined('good'),
    practice: joined('practice'),
  }
}

const PRACTICE_LIMIT = 2
const PRACTICE_LENGTH = 200
const WORD_LIMIT = 5

/** 지난 일기 교정에서 "연습할 점"을 최근 것부터 골라 온다. 지금 고치는 일기는 뺀다. */
export function recentPracticeNotes(journals, excludeId) {
  const notes = []
  for (const item of journals) {
    if (item.id === excludeId) continue
    const practice = parseFeedback(item.aiFeedback)?.practice
    if (practice) notes.push(practice.slice(0, PRACTICE_LENGTH))
    if (notes.length === PRACTICE_LIMIT) break
  }
  return notes
}

export function recentWordTexts(words) {
  return words
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .slice(0, WORD_LIMIT)
}

const SENTENCE_END = /(?<=[.!?])\s+/

/**
 * 교정의 "고칠 점" 한 줄을 표현 모음에 넣을 기록으로 바꾼다.
 * 고친 말이 표현이 되고, 원래 쓴 말과 이유가 뜻 칸에, 고친 문장 중 그 말이 든 문장이 예문에 들어간다.
 * source: 'journal'은 복습 때 뜻 대신 고친 말을 떠올리게 하는 표시다(src/components/Quiz.jsx).
 */
export function fixToExpression(fix, corrected = '', originalLabel = '원래') {
  const fixed = fix.fixed.trim()
  const sentence =
    corrected
      .split(SENTENCE_END)
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().includes(fixed.toLowerCase())) ?? ''
  const meaning = [`${originalLabel}: ${fix.original.trim()}`, fix.reason?.trim()].filter(Boolean).join(' · ')
  return { text: fixed, meaning, example: sentence, source: 'journal' }
}
