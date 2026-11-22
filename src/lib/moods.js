// 일기에 고르는 오늘의 기분. 고르면 배우는 언어로 그 기분을 쓴 짧은 예문을 보여 줘서 기분 고르기가 곧 단어 공부가 되게 한다.
// 외국인 연인·친구와 이야기할 때 자주 꺼내는 기분(보고 싶음, 사랑받는 느낌, 고마움, 질투, 걱정)까지 넣었다.
// id는 저장되는 값이라 영어 낱말로 두고 바꾸지 않는다. 화면에는 배우는 언어의 낱말을 보여 준다.
// 이모지는 쓰지 않는다. 앞의 12개는 바로 보이고, 나머지는 "기분 더 보기"로 연다.
// 스페인어·프랑스어 형용사는 남성형(여성형) 꼴로 적고, 예문은 남성형으로 썼다.
// 한국어를 배우는 사람(외국인 연인)에게는 뜻과 해석을 영어로 보여 준다.

// id, 우리말 뜻, 영어 뜻(한국어 학습자용), 배우는 언어별 낱말
const ROWS = [
  ['happy', '행복한', 'happy', { ja: '嬉しい', zh: '开心', es: 'feliz', fr: 'heureux (heureuse)', ko: '행복해' }],
  ['excited', '설레는', 'excited', { ja: 'ワクワクする', zh: '兴奋', es: 'emocionado (emocionada)', fr: 'avoir hâte', ko: '설레' }],
  ['loved', '사랑받는', 'loved', { ja: '愛されてる', zh: '被爱', es: 'querido (querida)', fr: 'aimé (aimée)', ko: '사랑받는' }],
  ['miss', '보고 싶은', 'to miss someone', { ja: '会いたい', zh: '想你', es: 'extrañar', fr: 'manquer', ko: '보고 싶어' }],
  ['grateful', '고마운', 'grateful', { ja: '感謝してる', zh: '感激', es: 'agradecido (agradecida)', fr: 'reconnaissant (reconnaissante)', ko: '고마워' }],
  ['calm', '차분한', 'calm', { ja: '落ち着いてる', zh: '平静', es: 'tranquilo (tranquila)', fr: 'calme', ko: '차분해' }],
  ['tired', '피곤한', 'tired', { ja: '疲れた', zh: '累', es: 'cansado (cansada)', fr: 'fatigué (fatiguée)', ko: '피곤해' }],
  ['busy', '바쁜', 'busy', { ja: '忙しい', zh: '忙', es: 'ocupado (ocupada)', fr: 'occupé (occupée)', ko: '바빠' }],
  ['lonely', '외로운', 'lonely', { ja: '寂しい', zh: '孤单', es: 'solo (sola)', fr: 'seul (seule)', ko: '외로워' }],
  ['sad', '슬픈', 'sad', { ja: '悲しい', zh: '难过', es: 'triste', fr: 'triste', ko: '슬퍼' }],
  ['upset', '속상한', 'upset', { ja: '落ち込んでる', zh: '心烦', es: 'molesto (molesta)', fr: 'contrarié (contrariée)', ko: '속상해' }],
  ['stressed', '스트레스 받은', 'stressed', { ja: 'ストレス', zh: '压力大', es: 'estresado (estresada)', fr: 'stressé (stressée)', ko: '스트레스 받아' }],
  ['proud', '뿌듯한', 'proud', { ja: '誇らしい', zh: '自豪', es: 'orgulloso (orgullosa)', fr: 'fier (fière)', ko: '뿌듯해' }],
  ['comfortable', '편안한', 'comfortable', { ja: 'くつろいでる', zh: '舒服', es: 'cómodo (cómoda)', fr: "à l'aise", ko: '편해' }],
  ['relieved', '안심한', 'relieved', { ja: 'ほっとした', zh: '放心', es: 'aliviado (aliviada)', fr: 'soulagé (soulagée)', ko: '안심이야' }],
  ['hopeful', '기대되는', 'looking forward', { ja: '楽しみ', zh: '期待', es: 'ilusionado (ilusionada)', fr: "plein d'espoir", ko: '기대돼' }],
  ['sleepy', '졸린', 'sleepy', { ja: '眠い', zh: '困', es: 'sueño', fr: 'sommeil', ko: '졸려' }],
  ['bored', '심심한', 'bored', { ja: '退屈', zh: '无聊', es: 'aburrido (aburrida)', fr: "s'ennuyer", ko: '심심해' }],
  ['nervous', '긴장한', 'nervous', { ja: '緊張', zh: '紧张', es: 'nervioso (nerviosa)', fr: 'nerveux (nerveuse)', ko: '긴장돼' }],
  ['worried', '걱정되는', 'worried', { ja: '心配', zh: '担心', es: 'preocupado (preocupada)', fr: 'inquiet (inquiète)', ko: '걱정돼' }],
  ['confused', '헷갈리는', 'confused', { ja: 'わからない', zh: '糊涂', es: 'confundido (confundida)', fr: 'perdu (perdue)', ko: '헷갈려' }],
  ['embarrassed', '민망한', 'embarrassed', { ja: '恥ずかしい', zh: '尴尬', es: 'vergüenza', fr: 'gêné (gênée)', ko: '민망해' }],
  ['jealous', '질투 나는', 'jealous', { ja: 'やきもち', zh: '吃醋', es: 'celoso (celosa)', fr: 'jaloux (jalouse)', ko: '질투 나' }],
  ['angry', '화난', 'angry', { ja: '怒った', zh: '生气', es: 'enojado (enojada)', fr: 'fâché (fâchée)', ko: '화나' }],
  ['sick', '아픈', 'sick', { ja: '体調が悪い', zh: '不舒服', es: 'enfermo (enferma)', fr: 'malade', ko: '아파' }],
]

// 언어별 예문 [예문, 해석]. 해석은 한국어(한국어 학습자에게는 영어).
const EXAMPLES = {
  en: {
    happy: ['I was really happy today.', '오늘 정말 행복했어.'],
    excited: ["I'm so excited for our date tomorrow!", '내일 데이트 너무 설레!'],
    loved: ['I felt so loved today.', '오늘 사랑받는 느낌이었어.'],
    miss: ['I miss you so much today.', '오늘 너무 보고 싶어.'],
    grateful: ["I'm so grateful for you.", '네가 있어서 정말 고마워.'],
    calm: ['I felt calm today.', '오늘은 마음이 차분했어.'],
    tired: ['I was so tired today.', '오늘 너무 피곤했어.'],
    busy: ['I was busy all day.', '하루 종일 바빴어.'],
    lonely: ['I felt a bit lonely tonight.', '오늘 밤엔 조금 외로웠어.'],
    sad: ['I felt a little sad today.', '오늘 조금 슬펐어.'],
    upset: ['I was upset about something today.', '오늘 어떤 일 때문에 속상했어.'],
    stressed: ['I was so stressed out today.', '오늘 스트레스 엄청 받았어.'],
    proud: ['I was proud of myself today.', '오늘 내가 뿌듯했어.'],
    comfortable: ['I felt comfortable at home today.', '오늘은 집에서 편안했어.'],
    relieved: ['I was so relieved to hear that.', '그 말 듣고 정말 안심했어.'],
    hopeful: ["I'm hopeful about tomorrow.", '내일이 기대돼.'],
    sleepy: ["I'm so sleepy right now.", '지금 너무 졸려.'],
    bored: ['I was bored at home today.', '오늘 집에서 심심했어.'],
    nervous: ['I was nervous before the call.', '통화 전에 긴장했어.'],
    worried: ["I'm a little worried about you.", '네가 조금 걱정돼.'],
    confused: ["I'm confused about what you meant.", '네가 무슨 뜻으로 말한 건지 헷갈려.'],
    embarrassed: ['I was so embarrassed!', '너무 민망했어!'],
    jealous: ['I got a little jealous.', '나 조금 질투 났어.'],
    angry: ['I got angry today.', '오늘 화가 났어.'],
    sick: ["I'm feeling sick today.", '오늘 몸이 안 좋아.'],
  },
  ja: {
    happy: ['今日は本当に嬉しかった。', '오늘 정말 기뻤어.'],
    excited: ['明日のデート、すごくワクワクする！', '내일 데이트 너무 설레!'],
    loved: ['今日はすごく愛されてるって感じた。', '오늘 정말 사랑받는 느낌이었어.'],
    miss: ['今日すごく会いたい。', '오늘 너무 보고 싶어.'],
    grateful: ['いつもそばにいてくれて感謝してる。', '늘 곁에 있어 줘서 고마워.'],
    calm: ['今日は気持ちが落ち着いてる。', '오늘은 마음이 차분해.'],
    tired: ['今日はすごく疲れた。', '오늘 너무 피곤했어.'],
    busy: ['一日中忙しかった。', '하루 종일 바빴어.'],
    lonely: ['今夜はちょっと寂しい。', '오늘 밤엔 조금 외로워.'],
    sad: ['今日は少し悲しかった。', '오늘 조금 슬펐어.'],
    upset: ['ちょっと落ち込んでる。', '조금 속상해.'],
    stressed: ['最近ストレスがたまってる。', '요즘 스트레스가 쌓였어.'],
    proud: ['今日は自分が誇らしかった。', '오늘 내가 뿌듯했어.'],
    comfortable: ['家でくつろいでる。', '집에서 편하게 쉬고 있어.'],
    relieved: ['それを聞いてほっとした。', '그 말 듣고 안심했어.'],
    hopeful: ['明日が楽しみ。', '내일이 기대돼.'],
    sleepy: ['今すごく眠い。', '지금 너무 졸려.'],
    bored: ['家にいて退屈だった。', '집에 있어서 심심했어.'],
    nervous: ['電話の前に緊張した。', '통화 전에 긴장했어.'],
    worried: ['ちょっと心配だよ。', '조금 걱정돼.'],
    confused: ['何のことかよくわからない。', '무슨 말인지 잘 모르겠어.'],
    embarrassed: ['めっちゃ恥ずかしかった！', '너무 민망했어!'],
    jealous: ['ちょっとやきもち焼いちゃった。', '조금 질투 났어.'],
    angry: ['今日はちょっと怒った。', '오늘 좀 화났어.'],
    sick: ['今日は体調が悪い。', '오늘 몸이 안 좋아.'],
  },
  zh: {
    happy: ['我今天真的很开心。', '오늘 정말 기뻤어.'],
    excited: ['明天的约会，我好兴奋！', '내일 데이트 너무 설레!'],
    loved: ['今天觉得自己被爱着。', '오늘 사랑받는 느낌이었어.'],
    miss: ['今天好想你。', '오늘 너무 보고 싶어.'],
    grateful: ['有你在，我很感激。', '네가 있어서 정말 고마워.'],
    calm: ['今天心情很平静。', '오늘은 마음이 차분해.'],
    tired: ['我今天好累。', '오늘 너무 피곤해.'],
    busy: ['我忙了一整天。', '하루 종일 바빴어.'],
    lonely: ['今晚有点孤单。', '오늘 밤엔 조금 외로워.'],
    sad: ['今天有点难过。', '오늘 조금 슬펐어.'],
    upset: ['今天有点心烦。', '오늘 좀 속상해.'],
    stressed: ['最近压力大。', '요즘 스트레스가 커.'],
    proud: ['今天我为自己感到自豪。', '오늘 내가 뿌듯했어.'],
    comfortable: ['在家好舒服。', '집에 있으니까 너무 편해.'],
    relieved: ['听你这么说，我就放心了。', '네가 그렇게 말하니까 안심이야.'],
    hopeful: ['我很期待明天。', '내일이 정말 기대돼.'],
    sleepy: ['我现在好困。', '지금 너무 졸려.'],
    bored: ['在家好无聊。', '집에 있으니까 너무 심심해.'],
    nervous: ['打电话之前我有点紧张。', '통화하기 전에 조금 긴장했어.'],
    worried: ['我有点担心你。', '네가 조금 걱정돼.'],
    confused: ['我有点糊涂了。', '조금 헷갈려.'],
    embarrassed: ['太尴尬了！', '너무 민망해!'],
    jealous: ['我有点吃醋了。', '나 조금 질투 났어.'],
    angry: ['我今天生气了。', '오늘 화났어.'],
    sick: ['我今天身体不舒服。', '오늘 몸이 안 좋아.'],
  },
  es: {
    happy: ['Hoy fui muy feliz.', '오늘 정말 행복했어.'],
    excited: ['¡Estoy muy emocionado por la cita de mañana!', '내일 데이트 너무 설레!'],
    loved: ['Hoy me sentí muy querido.', '오늘 정말 사랑받는 느낌이었어.'],
    miss: ['Hoy te extraño mucho.', '오늘 너무 보고 싶어.'],
    grateful: ['Estoy muy agradecido de tenerte.', '네가 있어서 정말 고마워.'],
    calm: ['Hoy me siento tranquilo.', '오늘은 마음이 차분해.'],
    tired: ['Hoy estoy muy cansado.', '오늘 너무 피곤해.'],
    busy: ['Estuve ocupado todo el día.', '하루 종일 바빴어.'],
    lonely: ['Esta noche me siento un poco solo.', '오늘 밤엔 조금 외로워.'],
    sad: ['Hoy estuve un poco triste.', '오늘 조금 슬펐어.'],
    upset: ['Hoy estoy un poco molesto.', '오늘 좀 속상해.'],
    stressed: ['Estoy muy estresado estos días.', '요즘 스트레스 많이 받아.'],
    proud: ['Hoy me sentí orgulloso de mí.', '오늘 내가 뿌듯했어.'],
    comfortable: ['En casa me siento muy cómodo.', '집에 있으니까 정말 편해.'],
    relieved: ['Me siento aliviado de escuchar eso.', '그 말 들으니까 안심이야.'],
    hopeful: ['Estoy ilusionado con mañana.', '내일이 기대돼.'],
    sleepy: ['Tengo mucho sueño ahora.', '지금 너무 졸려.'],
    bored: ['Estuve aburrido en casa.', '집에서 심심했어.'],
    nervous: ['Estaba nervioso antes de la llamada.', '통화 전에 긴장했어.'],
    worried: ['Estoy un poco preocupado por ti.', '네가 조금 걱정돼.'],
    confused: ['Estoy confundido, ¿qué quisiste decir?', '헷갈려, 무슨 뜻이었어?'],
    embarrassed: ['¡Qué vergüenza!', '너무 민망해!'],
    jealous: ['Me puse un poco celoso.', '나 조금 질투 났어.'],
    angry: ['Hoy estaba enojado.', '오늘 화났어.'],
    sick: ['Hoy estoy enfermo.', '오늘 몸이 아파.'],
  },
  fr: {
    happy: ["J'étais vraiment heureux aujourd'hui.", '오늘 정말 행복했어.'],
    excited: ["J'ai trop hâte de notre rendez-vous demain !", '내일 데이트 너무 기대돼!'],
    loved: ["Je me suis senti aimé aujourd'hui.", '오늘 사랑받는 느낌이었어.'],
    miss: ["Tu me manques tellement aujourd'hui.", '오늘 네가 너무 보고 싶어.'],
    grateful: ["Je suis tellement reconnaissant de t'avoir.", '네가 있어서 정말 고마워.'],
    calm: ["Je me sens calme aujourd'hui.", '오늘은 마음이 차분해.'],
    tired: ["J'étais trop fatigué aujourd'hui.", '오늘 너무 피곤했어.'],
    busy: ["J'ai été occupé toute la journée.", '하루 종일 바빴어.'],
    lonely: ['Je me sens un peu seul ce soir.', '오늘 밤엔 조금 외로워.'],
    sad: ["J'étais un peu triste aujourd'hui.", '오늘 조금 슬펐어.'],
    upset: ["Je suis un peu contrarié aujourd'hui.", '오늘 좀 속상해.'],
    stressed: ['Je suis super stressé en ce moment.', '요즘 스트레스 엄청 받아.'],
    proud: ["J'étais fier de moi aujourd'hui.", '오늘 내가 뿌듯했어.'],
    comfortable: ["Je suis bien à l'aise à la maison.", '집에 있으니까 정말 편해.'],
    relieved: ["Je suis soulagé de l'entendre.", '그 말 들으니까 안심이야.'],
    hopeful: ["Je suis plein d'espoir pour demain.", '내일이 기대돼.'],
    sleepy: ["J'ai trop sommeil là.", '지금 너무 졸려.'],
    bored: ["Je me suis ennuyé à la maison.", '집에서 심심했어.'],
    nervous: ["J'étais nerveux avant l'appel.", '통화 전에 긴장했어.'],
    worried: ['Je suis un peu inquiet pour toi.', '네가 조금 걱정돼.'],
    confused: ['Je suis un peu perdu, tu veux dire quoi ?', '좀 헷갈려, 무슨 뜻이야?'],
    embarrassed: ["J'étais trop gêné !", '너무 민망했어!'],
    jealous: ["J'étais un peu jaloux.", '나 조금 질투 났어.'],
    angry: ["J'étais fâché aujourd'hui.", '오늘 화났어.'],
    sick: ["Je suis malade aujourd'hui.", '오늘 몸이 아파.'],
  },
  ko: {
    happy: ['오늘 정말 행복했어.', 'I was really happy today.'],
    excited: ['내일 데이트 너무 설레!', "I'm so excited for our date tomorrow!"],
    loved: ['오늘 사랑받는 느낌이었어.', 'I felt so loved today.'],
    miss: ['오늘 너무 보고 싶어.', 'I miss you so much today.'],
    grateful: ['네가 있어서 정말 고마워.', "I'm so grateful to have you."],
    calm: ['오늘은 마음이 차분해.', 'I feel calm today.'],
    tired: ['오늘 너무 피곤했어.', 'I was so tired today.'],
    busy: ['하루 종일 바빴어.', 'I was busy all day.'],
    lonely: ['오늘 밤엔 조금 외로워.', 'I feel a bit lonely tonight.'],
    sad: ['오늘 조금 슬펐어.', 'I was a little sad today.'],
    upset: ['오늘 좀 속상했어.', 'I was a bit upset today.'],
    stressed: ['요즘 스트레스 많이 받아.', "I'm really stressed these days."],
    proud: ['오늘 내가 뿌듯했어.', 'I was proud of myself today.'],
    comfortable: ['집에 있으니까 편해.', 'I feel comfortable at home.'],
    relieved: ['그 말 들으니까 안심이야.', "I'm relieved to hear that."],
    hopeful: ['내일이 기대돼.', "I'm looking forward to tomorrow."],
    sleepy: ['지금 너무 졸려.', "I'm so sleepy right now."],
    bored: ['집에 있으니까 심심해.', "I'm bored at home."],
    nervous: ['통화하기 전에 긴장돼.', 'I get nervous before calls.'],
    worried: ['네가 조금 걱정돼.', "I'm a little worried about you."],
    confused: ['무슨 뜻인지 헷갈려.', "I'm confused about what you mean."],
    embarrassed: ['너무 민망했어!', 'I was so embarrassed!'],
    jealous: ['나 조금 질투 났어.', 'I got a little jealous.'],
    angry: ['오늘 화났어.', 'I got angry today.'],
    sick: ['오늘 몸이 아파.', "I'm sick today."],
  },
}

export const MOOD_LANGS = Object.keys(EXAMPLES)

export const MOODS = ROWS.map(([id, ko, en, words]) => ({ id, ko, en, words: { en: id, ...words } }))

/** 처음부터 보이는 기분 수 */
export const MOODS_SHOWN = 12

export const MOOD_IDS = MOODS.map((mood) => mood.id)

// 요일 도장 색: 기분이 좋은 날(good), 힘든 날(low), 그 밖(plain)
const GOOD = new Set(['happy', 'excited', 'loved', 'grateful', 'proud', 'calm', 'comfortable', 'relieved', 'hopeful'])
const LOW = new Set(['tired', 'lonely', 'sad', 'upset', 'stressed', 'sleepy', 'bored', 'nervous', 'worried', 'confused', 'embarrassed', 'jealous', 'angry', 'sick'])
export const moodTone = (id) => (GOOD.has(id) ? 'good' : LOW.has(id) ? 'low' : 'plain')

export const moodOf = (id) => MOODS.find((mood) => mood.id === id) ?? null

const langOf = (lang) => (MOOD_LANGS.includes(lang) ? lang : 'en')

/** 배우는 언어로 쓴 기분 낱말(예: happy, 嬉しい, feliz) */
export const moodWord = (mood, lang) => mood.words[langOf(lang)]

/** 기분 낱말의 뜻: 한국어 학습자에게는 영어, 그 밖에는 우리말 */
export const moodMeaning = (mood, lang) => (langOf(lang) === 'ko' ? mood.en : mood.ko)

/** 그 기분을 쓴 예문과 해석 */
export function moodExample(mood, lang) {
  const [sentence, translation] = EXAMPLES[langOf(lang)][mood.id]
  return { sentence, translation }
}

/** 기분 낱말을 단어장에 넣을 기록으로 바꾼다. */
export const moodToWord = (mood, lang = 'en') => ({
  text: moodWord(mood, lang),
  meaning: moodMeaning(mood, lang),
  example: moodExample(mood, lang).sentence,
})
