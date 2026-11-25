// 학술제 시연용 데이터: "3주 동안 쓴 것처럼" 미리 채운 시연 계정 기록과 친구 문장.
//
// 실제 사용자 기록이 아니다. 시간이 지나야 보이는 기능(달력, 연속 기록, 복습 일정, 헷갈리는 말)을 발표 당일에 보여 주려고
// 날짜를 과거로 맞춘 예시 데이터이고, 발표에서도 "시연용 계정"이라고 밝힌다.
// 시연 계정 이메일에는 +demo를 넣는다(예: 내주소+demo@gmail.com, 내주소+demofriend@gmail.com).
// 사용 기록 분석(analysis/usage)은 +demo 계정을 기본으로 뺀다.
//
// 실행: node scripts/make-demo-data.mjs                발표 전날 실행 권장(오늘을 기준으로 21일 전까지 채움)
//       node scripts/make-demo-data.mjs --end 2026-12-03  기준 날짜를 정해서
// 결과(저장소에 올리지 않음, .gitignore):
//   demo-data/demo-backup.json      시연(학습자) 계정에서 프로필 > 내 데이터 > 백업 가져오기
//   demo-data/demo-sentences.sql    두 시연 계정이 앱에서 친구로 짝이 된 뒤 Supabase SQL Editor에서 실행
// 내용은 친구와 실제로 주고받을 만한 말로 지었고(욕·마약 관련 슬랭은 넣지 않음), 사람 이름은 넣지 않았다.

import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = join(ROOT, 'demo-data')
const args = process.argv.slice(2)
const endArg = args.includes('--end') ? args[args.indexOf('--end') + 1] : null

// 기준 날짜(한국 시간). 이 날은 비워 두고 발표 때 직접 쓴다.
const end = endArg ? new Date(`${endArg}T00:00:00+09:00`) : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
const kst = (daysAgo, hour = 21, minute = 0) => {
  const d = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate() - daysAgo, hour - 9, minute))
  return d.toISOString()
}
const ymd = (daysAgo) => kst(daysAgo, 12).slice(0, 10)
const inDays = (days) => kst(-days, 4) // 앞으로 며칠 뒤 새벽(복습 예정일)

// 복습 상태: box(0~6), 지난 복습, 다음 복습, 복습·틀린 횟수
const review = (box, lastAgo, dueIn, reviews, misses) => ({
  box,
  lastReviewedAt: kst(lastAgo, 22),
  dueAt: inDays(dueIn),
  reviews,
  misses,
})

// [며칠 전, 낱말, 뜻, 예문, 카테고리, 복습 상태]
const WORDS = [
  [20, 'initially', '처음에는', "I initially didn't like him, but now we're close.", 'daily', review(4, 3, 9, 5, 0)],
  [19, 'witty', '재치 있는', "You're so witty, I can't keep up.", 'friends', review(3, 2, 4, 4, 1)],
  [18, 'fascinating', '정말 흥미로운, 빠져드는', "That's fascinating, tell me more.", 'feelings', review(2, 1, 1, 4, 2)],
  [17, 'outrageous', '말도 안 되는, 어이없는', 'That price is outrageous.', 'daily', review(1, 1, 0, 4, 2)],
  [15, 'overall', '전반적으로', 'Overall, I had a good time.', 'daily', review(3, 4, 3, 3, 0)],
  [14, 'photogenic', '사진이 잘 받는', "You're so photogenic, it's not fair.", 'friends', review(2, 2, 2, 2, 0)],
  [12, 'upcoming', '다가오는, 예정된', 'Any upcoming plans this weekend?', 'daily', review(1, 2, 0, 2, 1)],
  [11, 'self-esteem', '자존감', 'Working out really helped my self-esteem.', 'feelings', review(0, 1, 0, 3, 2)],
  [9, 'sophisticated', '세련된, 정교한', 'Your taste in music is so sophisticated.', 'friends', review(1, 1, 0, 1, 0)],
  [8, 'generic', '뻔한, 흔한', 'That pickup line is so generic lol', 'friends', review(0, 1, 0, 2, 1)],
  [6, 'dramatic', '오버하는, 과장된', "Don't be so dramatic, it's just a test.", 'friends', review(1, 1, 1, 1, 0)],
  [5, 'stable', '안정적인', 'I just want a stable job for now.', 'work', review(0, 1, 0, 1, 0)],
  [3, 'merely', '그저, 단지', 'It was merely a joke.', 'daily', null],
  [2, 'affection', '애정, 다정함', 'He shows affection in small ways.', 'love', null],
]

// [며칠 전, 표현, 뜻, 예문, 카테고리, 복습 상태]
const EXPRESSIONS = [
  [20, 'I think we have similar tastes.', '우리 취향이 비슷한 것 같아.', 'I think we have similar tastes in movies.', 'friends', review(4, 4, 8, 5, 0)],
  [19, 'That sounds like a nightmare.', '진짜 최악이겠다.', 'Two exams in one day? That sounds like a nightmare.', 'daily', review(3, 3, 3, 4, 1)],
  [18, 'Do you see yourself doing this again?', '너 이거 또 할 것 같아?', 'That hike was brutal. Do you see yourself doing it again?', 'friends', review(1, 1, 0, 5, 3)],
  [16, 'It worked out in the end.', '결국 잘 풀렸어.', 'I was so worried, but it worked out in the end.', 'daily', review(3, 2, 4, 3, 0)],
  [15, 'Feel free to reach out.', '언제든 연락해.', 'Feel free to reach out if you need anything.', 'friends', review(2, 2, 1, 3, 1)],
  [13, 'Aside from that, everything was fine.', '그거 말고는 다 괜찮았어.', 'The food was cold. Aside from that, everything was fine.', 'daily', review(2, 1, 2, 2, 0)],
  [12, 'I think we have a lot in common.', '우리 통하는 게 많은 것 같아.', 'We both love rainy days. I think we have a lot in common.', 'friends', review(2, 2, 1, 2, 0)],
  [10, 'Thanks for pointing it out.', '짚어 줘서 고마워.', 'Oh, I spelled it wrong. Thanks for pointing it out.', 'daily', review(1, 1, 0, 2, 1)],
  [9, "I think that's what's happening to me.", '나도 지금 딱 그런 것 같아.', "Burnout? Yeah, I think that's what's happening to me.", 'feelings', review(0, 1, 0, 3, 2)],
  [7, 'We made eye contact.', '우리 눈 마주쳤어.', 'We made eye contact and both started laughing.', 'love', review(1, 1, 1, 1, 0)],
  [6, 'Shoot your shot.', '한번 들이대 봐, 고백해 봐.', 'Just shoot your shot, what do you have to lose?', 'love', review(0, 1, 0, 1, 1)],
  [4, "It's far from perfect.", '전혀 완벽하지 않아.', "My English is far from perfect, but I'm trying.", 'daily', null],
  [3, "You're kinda suspicious.", '너 좀 수상한데?', "You're kinda suspicious today. What's going on?", 'friends', null],
  [1, "Don't trip.", '괜히 오버하지 마, 신경 쓰지 마.', "Don't trip, it's not a big deal.", 'friends', null],
]

// [며칠 전, 문법, 설명, 예문, 해석, 일기 교정에서 담았나]
const GRAMMAR = [
  [17, 'see yourself + -ing', '앞으로 내가 ~하는 모습이 그려지다, ~할 것 같다', 'Do you see yourself living abroad?', '너 외국에서 살 것 같아?', true],
  [13, 'If I were to + 동사원형', '(가령) 내가 ~한다면 — If I + 과거형보다 더 가정하는 느낌', 'If I were to pick one movie, it would be this.', '영화 하나를 고른다고 치면 이거야.', true],
  [10, 'a place to + 동사원형', '~하기 좋은 곳 (for + -ing보다 자연스러움)', "It's a nice place to live.", '살기 좋은 곳이야.', true],
  [5, "what's happening to me", 'what이 "~하는 것"이라는 명사절을 만든다', "That's exactly what's happening to me.", '그게 딱 지금 나한테 일어나는 일이야.', false],
]

// [며칠 전, 기분, 우리말, 번역, AI 교정 여부]
const JOURNALS = [
  [20, 'excited', '오늘 처음으로 외국인 친구랑 30분 넘게 영상통화를 했다.', 'Today I did video call with my foreign friend for more than 30 minutes first time.', true],
  [18, 'happy', '친구랑 영화 얘기를 했는데 취향이 정말 비슷했다.', 'I talked about movies with my friend and we have a similar taste.', true],
  [16, 'tired', '시험 공부 때문에 하루 종일 도서관에 있었다.', 'I was in the library all day because of studying exam.', false],
  [14, 'proud', '처음으로 영어 메시지를 사전 없이 보냈다.', 'I sent an English message without dictionary for the first time.', true],
  [12, 'nervous', '발표 준비를 하는데 너무 긴장된다.', "I'm preparing my presentation and I'm so nervous.", false],
  [11, 'confused', '친구가 "Do you see yourself doing it again?"이라고 물어봤는데 처음엔 무슨 뜻인지 몰랐다.', "My friend asked me 'Do you see yourself doing it again?' and I didn't understand initially.", true],
  [9, 'calm', '비가 와서 집에서 음악을 들으며 쉬었다.', 'It rained so I rested at home listening music.', false],
  [7, 'grateful', '친구가 내 문장을 고쳐 줘서 고마웠다.', 'I was thankful because my friend pointed out my mistake.', true],
  [5, 'stressed', '과제가 세 개나 겹쳐서 스트레스를 받았다.', 'Three assignments overlapped so I was stressed.', false],
  [4, 'happy', '미국에 사는 친구가 자기 동네가 살기 좋다고 했다.', 'My friend in the States said her town is a nice place for living.', true],
  [2, 'relieved', '걱정했던 시험이 생각보다 잘 끝났다.', 'The exam I was worried about worked out in the end.', false],
  [1, 'hopeful', '다음 달에 친구를 직접 만나기로 했다.', "We decided to meet in person next month. I can't wait.", false],
]

// AI 교정 결과(앱이 받는 형식 그대로). 시연 계정 일기 중 일부에만 붙인다. AI가 실제로 쓴 답이 아니라 시연용으로 지은 예시다.
const FEEDBACK = {
  20: {
    corrected: 'Today I video-called my friend abroad for over 30 minutes for the first time.',
    fixes: [['did video call', 'video-called', 'video call을 동사로 쓰면 더 자연스러워요.'], ['first time', 'for the first time', '"처음으로"는 for the first time이에요.']],
    natural: [["We FaceTimed for like half an hour — first time ever!", '친구에게 말할 때 쓰는 편한 말투예요.']],
    grammar: [['for the first time', '처음으로 한 일을 말할 때 문장 끝에 붙여요.', 'I tried kimchi for the first time.', '김치를 처음 먹어 봤어.']],
    good: '오늘 있었던 일을 한 문장으로 분명하게 썼어요.',
    practice: 'for the first time을 다른 문장에도 써 보세요.',
  },
  18: {
    corrected: 'I talked about movies with my friend, and I think we have similar tastes.',
    fixes: [['a similar taste', 'similar tastes', '취향을 말할 때는 보통 복수형 tastes를 써요.']],
    natural: [['I think we have similar tastes in movies.', '무엇의 취향인지 in + 명사로 붙이면 더 자연스러워요.'], ['We have the same taste in movies, lowkey.', '친한 사이에서 가볍게 말할 때 써요.']],
    grammar: [['I think + 문장', '"~인 것 같아"를 부드럽게 말할 때 문장 앞에 붙여요.', 'I think it will rain today.', '오늘 비 올 것 같아.']],
    good: '대화 주제를 구체적으로 적었어요.',
    practice: 'I think + 문장으로 내 생각을 말해 보세요.',
  },
  14: {
    corrected: 'I sent an English message without a dictionary for the first time.',
    fixes: [['without dictionary', 'without a dictionary', '셀 수 있는 명사 하나 앞에는 a를 붙여요.']],
    natural: [["Sent my first English text without a dictionary. Proud of myself!", '뿌듯한 마음을 담아 메시지처럼 말할 때 써요.']],
    grammar: [['a / an', '셀 수 있는 명사가 하나일 때 앞에 붙여요.', 'I need a charger.', '충전기 하나 필요해.']],
    good: '지난번에 연습한 for the first time을 잘 썼어요.',
    practice: '명사 앞에 a를 붙여야 하는지 한 번 더 확인해 보세요.',
  },
  11: {
    corrected: "My friend asked me, 'Do you see yourself doing it again?' and at first I didn't understand.",
    fixes: [['initially', 'at first', '대화에서는 at first가 더 자연스러워요. initially도 틀리지는 않아요.']],
    natural: [["Took me a sec to get what she meant lol", '처음엔 바로 이해 못 했다는 걸 가볍게 말할 때 써요.']],
    grammar: [['see yourself + -ing', '앞으로 내가 ~하는 모습이 그려지다, ~할 것 같다', 'Do you see yourself living abroad?', '너 외국에서 살 것 같아?']],
    good: '들은 말을 그대로 옮겨 적어서 나중에 다시 보기 좋아요.',
    practice: 'see yourself + -ing로 질문을 하나 만들어 보세요.',
  },
  7: {
    corrected: 'I was grateful because my friend pointed out my mistake.',
    fixes: [['thankful', 'grateful', '둘 다 맞지만 일기에서는 grateful이 더 자주 쓰여요.']],
    natural: [['Shoutout to my friend for catching my mistake.', '고마운 사람을 가볍게 언급할 때 써요.']],
    grammar: [['point out', '지적하다, 짚어 주다 (point at은 손가락으로 가리키다)', 'Thanks for pointing it out.', '짚어 줘서 고마워.']],
    good: 'point out을 문장 안에서 바르게 썼어요.',
    practice: '고마운 일을 because 문장으로 이유와 함께 써 보세요.',
  },
  4: {
    corrected: 'My friend in the States said her town is a nice place to live.',
    fixes: [['a nice place for living', 'a nice place to live', '"~하기 좋은 곳"은 place + to + 동사원형이 자연스러워요.']],
    natural: [["She said it's a nice place to be when you live in the States.", '그곳에 머무는 경험 자체가 좋다는 느낌이에요.']],
    grammar: [['a place to + 동사원형', '~하기 좋은 곳 (for + -ing보다 자연스러움)', "It's a nice place to relax.", '쉬기 좋은 곳이야.']],
    good: '친구가 한 말을 간접적으로 잘 옮겼어요.',
    practice: 'a nice place to + 동사로 내가 좋아하는 장소를 소개해 보세요.',
  },
}

function feedbackText(f) {
  return [
    '## 고친 문장',
    f.corrected,
    '## 고칠 점',
    ...f.fixes.map(([a, b, why]) => `- 원래: ${a} → 고침: ${b} | 이유: ${why}`),
    '## 더 자연스러운 표현',
    ...f.natural.map(([text, when]) => `- ${text} | ${when}`),
    '## 문법 포인트',
    ...f.grammar.map(([g, d, ex, ko]) => `- 문법: ${g} | 설명: ${d} | 예문: ${ex} | 해석: ${ko}`),
    '## 잘한 점',
    f.good,
    '## 연습할 점',
    f.practice,
  ].join('\n')
}

// [며칠 전, 상황, 받은/보낸 말, 뜻, 대화 카테고리]
const CHATS = [
  [19, '약속 시간을 정할 때 친구가 보냄', 'bet, see you at 7', '좋아, 7시에 봐', 'plans'],
  [15, '내 사진을 보고 친구가 한 말', 'ok you look so photogenic here', '여기서 너 사진 진짜 잘 받는다', 'daily'],
  [10, '시험 망했다고 하자 친구가 위로함', "don't trip, it'll work out", '너무 신경 쓰지 마, 잘 될 거야', 'emotion'],
  [6, '친구가 비싼 가격을 보고', "that's outrageous lmao", '이건 진짜 말도 안 된다 ㅋㅋ', 'joke'],
]

const words = WORDS.map(([ago, text, meaning, example, category, r], i) => ({
  id: randomUUID(), createdAt: kst(ago, 20, i), text, meaning, example, category, ...(r ?? {}),
}))
const expressions = EXPRESSIONS.map(([ago, text, meaning, example, category, r], i) => ({
  id: randomUUID(), createdAt: kst(ago, 21, i), text, meaning, example, category, ...(r ?? {}),
}))
const grammar = GRAMMAR.map(([ago, text, meaning, example, exampleNative, fromJournal], i) => ({
  id: randomUUID(), createdAt: kst(ago, 22, i), text, meaning, example, exampleNative,
  ...(fromJournal ? { source: 'journal' } : {}),
  ...review(ago > 10 ? 2 : 0, 1, ago > 10 ? 2 : 0, ago > 10 ? 3 : 1, ago > 10 ? 1 : 1),
}))
const journal = JOURNALS.map(([ago, mood, native, translation, ai]) => ({
  id: randomUUID(), createdAt: kst(ago, 23), mood, native, translation, memo: '',
  aiFeedback: ai && FEEDBACK[ago] ? feedbackText(FEEDBACK[ago]) : '',
}))
const chat = CHATS.map(([ago, situation, message, meaning, category]) => ({
  id: randomUUID(), createdAt: kst(ago, 19), situation, message, meaning, category, note: '',
}))

// 친구 문장: [며칠 전, 친구(+demofriend)가 보낸 문장, 내가(+demo) 보낸 문장, 내가 친구 문장에 단 반응]
const SENTENCES = [
  [13, 'Good luck on your exam today!', 'Thanks! I was so nervous lol', 'thanks'],
  [12, 'How did it go?', 'It worked out in the end!', 'heart'],
  [11, "Wanna FaceTime this weekend? bet", 'Bet! Saturday works for me.', 'learned'],
  [9, "That price is outrageous lmao", "Right?? I can't believe it.", 'funny'],
  [8, 'Do you see yourself living abroad someday?', 'Hmm maybe! If I were to pick, I would choose Canada.', 'learned'],
  [6, "I think we have a lot in common", 'Same! We have similar tastes in everything.', 'heart'],
  [5, "Don't trip about the presentation, you got this", 'Thank you, that means a lot.', 'thanks'],
  [3, 'Feel free to reach out if you need help with English', "I will! You're the best.", 'heart'],
  [2, "You're kinda suspicious today... what's up?", "Haha nothing, I'm just in a good mood.", 'funny'],
  [1, 'Can\'t wait to see you next month!', "Me too! Let's make a list of places to go.", 'heart'],
]
const q = (text) => `'${text.replace(/'/g, "''")}'`
const sentenceRows = SENTENCES.flatMap(([ago, theirs, mine]) => [
  `  (${q(ymd(ago))}::date, 'friend', ${q(theirs)}, ${q(kst(ago, 13))}::timestamptz)`,
  `  (${q(ymd(ago))}::date, 'learner', ${q(mine)}, ${q(kst(ago, 20))}::timestamptz)`,
])
const reactionRows = SENTENCES.map(([ago, , , kind]) => `  (${q(ymd(ago))}::date, ${q(kind)})`)

const sql = `-- 학술제 시연용 친구 문장(지난 ${SENTENCES[0][0]}일). 실제 대화가 아니라 시연용으로 지은 예시다.
-- 기준 날짜: ${ymd(0)} (이 날짜의 문장은 비워 두고 발표 때 직접 주고받는다)
--
-- 미리 할 일: 두 시연 계정(이메일에 +demo / +demofriend)이 앱에서 "친구"로 짝이 되어 있어야 한다.
-- 쓰는 법: Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run. 여러 번 실행해도 같은 날 문장은 한 번만 들어간다.
-- 옛날 문장을 넣는 동안에는 새 문장 알림 장치를 잠깐 끈다(알림이 한꺼번에 쌓이지 않게).

begin;

alter table public.couple_sentences disable trigger couple_sentence_notify;

with learner as (select id from auth.users where lower(email) like '%+demo@%' limit 1),
friend as (select id from auth.users where lower(email) like '%+demofriend@%' limit 1),
pair as (
  select a.couple_id
  from public.couple_members a join public.couple_members b on a.couple_id = b.couple_id
  where a.user_id = (select id from learner) and b.user_id = (select id from friend)
  limit 1
),
src (day, who, body, at) as (values
${sentenceRows.join(',\n')}
)
insert into public.couple_sentences (couple_id, user_id, day, body, lang, created_at)
select (select couple_id from pair),
       case when r.who = 'learner' then (select id from learner) else (select id from friend) end,
       r.day, r.body, 'en', r.at
from src r
where (select couple_id from pair) is not null
on conflict (couple_id, user_id, day) do nothing;

alter table public.couple_sentences enable trigger couple_sentence_notify;

-- 내가(+demo) 친구 문장에 단 반응(반응 알림 장치도 잠깐 끈다)
alter table public.couple_reactions disable trigger couple_reaction_notify;

with learner as (select id from auth.users where lower(email) like '%+demo@%' limit 1),
friend as (select id from auth.users where lower(email) like '%+demofriend@%' limit 1),
picks (day, kind) as (values
${reactionRows.join(',\n')}
)
insert into public.couple_reactions (sentence_id, user_id, kind, created_at)
select s.id, (select id from learner), p.kind, s.created_at + interval '2 hours'
from picks p
join public.couple_sentences s on s.day = p.day and s.user_id = (select id from friend)
join public.couple_members m on m.couple_id = s.couple_id and m.user_id = (select id from learner)
on conflict (sentence_id, user_id) do nothing;

alter table public.couple_reactions enable trigger couple_reaction_notify;

commit;

-- 확인: 날짜별로 두 사람 문장이 보이면 성공
select s.day, case when u.email like '%+demofriend@%' then '친구' else '나' end as who, s.body
from public.couple_sentences s join auth.users u on u.id = s.user_id
where u.email like '%+demo%'
order by s.day, who;
`

const backup = {
  note: '학술제 시연용 예시 데이터입니다. 실제 사용 기록이 아닙니다.',
  exportedAt: new Date().toISOString(),
  word: words,
  expression: expressions,
  grammar,
  journal,
  chat,
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'demo-backup.json'), JSON.stringify(backup, null, 1) + '\n')
writeFileSync(join(OUT, 'demo-sentences.sql'), sql)
console.log(
  `기준 ${ymd(0)} · 단어 ${words.length} · 표현 ${expressions.length} · 문법 ${grammar.length} · 일기 ${journal.length} · 대화 ${chat.length} · 친구 문장 ${SENTENCES.length * 2}`,
)
console.log(`-> ${OUT}`)
