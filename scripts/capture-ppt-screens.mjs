// 발표 자료용 화면 캡처. 실제 서버가 아니라 테스트용 가짜 주소로 빌드한 앱을 띄우고(:4173 로그인 없는 모드,
// :4174 가짜 Supabase), 화면마다 가짜 데이터를 넣어 휴대폰 크기(Pixel 7)로 찍는다. 사람 이름·이메일은 모두 지어낸 것이다.
// 실행: 두 서버를 먼저 띄운 뒤(README의 테스트 방법과 같다) `node scripts/capture-ppt-screens.mjs`
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const OUT = 'docs/ppt/screens'
const LOCAL = 'http://localhost:4173/'
const AUTH = 'http://localhost:4174/'
const ME = '11111111-1111-4111-8111-111111111111'
const PARTNER = '22222222-2222-4222-8222-222222222222'
mkdirSync(OUT, { recursive: true })

const day = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  return date
}
const iso = (offset, hour = 9) => {
  const date = day(offset)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}
const ymd = (offset = 0) => {
  const date = day(offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const seed = {
  onboarded: '1',
  savedWords: [
    { id: 'w1', createdAt: iso(0), text: 'thoughtful', meaning: '사려 깊은, 배려하는', example: 'It was such a thoughtful gift.' },
    { id: 'w2', createdAt: iso(1), text: 'hang out', meaning: '어울려 놀다', example: 'Wanna hang out this weekend?' },
    { id: 'w3', createdAt: iso(2), text: 'clingy', meaning: '(연인에게) 너무 달라붙는', example: 'Sorry if I’m being clingy lol' },
    { id: 'w4', createdAt: iso(4), text: 'jet lag', meaning: '시차로 인한 피로', example: 'Still fighting jet lag.' },
  ],
  savedExpressions: [
    { id: 'e1', createdAt: iso(0), text: 'I miss you already.', meaning: '벌써 보고 싶어.', example: '' },
    { id: 'e2', createdAt: iso(3), text: 'You up?', meaning: '안 자?', example: '' },
  ],
  savedChats: [
    {
      id: 'c1',
      createdAt: iso(1),
      situation: '영상통화를 끝낼 때',
      message: 'Talk to you tomorrow, sleep tight!',
      meaning: '내일 또 얘기하자, 잘 자!',
      category: 'affection',
      note: '',
    },
  ],
  savedJournals: [
    {
      id: 'j1',
      createdAt: iso(1),
      mood: 'happy',
      native: '오늘 처음으로 영상통화를 30분 넘게 했다.',
      translation: 'Today I video called for over 30 minutes for the first time.',
      memo: '',
      aiFeedback: '',
    },
    {
      id: 'j2',
      createdAt: iso(3),
      mood: 'tired',
      native: '시험 때문에 너무 피곤했다.',
      translation: 'I was so tired because of exams.',
      memo: '',
      aiFeedback: '',
    },
  ],
}

const journalFeedback = [
  '## 고친 문장',
  'I missed you so much today that I kept checking my phone.',
  '## 고칠 점',
  '- 원래: I miss you very much today → 고침: I missed you so much today | 이유: 지난 일을 말하니 과거형이 자연스럽고, 말할 때는 so much를 더 많이 써요.',
  '- 원래: so I see my phone again and again → 고침: that I kept checking my phone | 이유: "계속 ~했다"는 kept + -ing로 말해요.',
  '## 잘한 점',
  '보고 싶은 마음을 솔직하고 구체적으로 전했어요.',
  '## 연습할 점',
  'keep + -ing(계속 ~하다)를 다른 문장에도 써 보세요.',
].join('\n')

const polishReply = [
  '1) I couldn’t stop thinking about you all day.',
  '다정하게: 하루 종일 네 생각이 떠나지 않았다는 따뜻한 말투예요.',
  '2) Not gonna lie, you lived in my head rent-free today lol',
  '장난스럽게: "rent-free"는 "머릿속에서 안 나간다"는 인터넷 표현이에요.',
  '3) I thought about you a lot today.',
  '담백하게: 부담 없이 보내기 좋은 기본 말투예요.',
  'Tip: rent-free는 친한 사이에서 장난스럽게 쓰는 말이에요.',
].join('\n')

const explainReply = [
  '1) 뜻: 솔직히 말하면 너 좀 귀여워 ㅋㅋ',
  '2) 슬랭·줄임말',
  'ngl - not gonna lie, 솔직히 말해서',
  'ur - your / you’re를 줄인 말',
  'lol - 웃음(ㅋㅋ), 가볍게 넘기는 느낌',
  '3) 말투: 장난스럽지만 호감을 살짝 드러내는 말이에요. 부담을 덜려고 lol을 붙였어요.',
  '4) 답장 예시',
  'Haha you’re not so bad yourself - 하하 너도 꽤 괜찮은데',
  'Stop it, you’re making me blush - 그만해, 얼굴 빨개지잖아',
].join('\n')

const browser = await chromium.launch({ channel: 'chrome' })

async function newPage({ dark = false, extraStorage = {} } = {}) {
  const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: dark ? 'dark' : 'light', serviceWorkers: 'block' })
  await context.addInitScript(
    (data) => {
      for (const [key, value] of Object.entries(data)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    },
    { ...seed, ...extraStorage },
  )
  return { context, page: await context.newPage() }
}

// 로그인한 상태(가짜 세션)와 가짜 Supabase. handle(url, request)가 응답을 정하지 않으면 빈 응답을 준다.
async function signIn(page, handle = () => null) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-example-auth-token',
      JSON.stringify({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'learner@example.com', user_metadata: { nickname: 'Learner' } },
      }),
    )
    localStorage.setItem('aiConsent', '2')
  })
  await page.route('https://example.supabase.co/auth/v1/**', (route) => route.fulfill({ json: {} }))
  await page.route('https://example.supabase.co/rest/v1/**', async (route) => {
    const request = route.request()
    const answer = await handle(request.url(), request)
    if (answer !== null && answer !== undefined) return route.fulfill({ json: answer })
    return route.fulfill(request.method() === 'GET' ? { json: [] } : { status: 201, json: [] })
  })
}

async function shot(page, name, { full = false } = {}) {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  console.log('saved', `${OUT}/${name}.png`)
}

async function capture(name, run) {
  try {
    await run()
  } catch (error) {
    console.log('FAILED', name, error.message.split('\n')[0])
  }
}

await capture('01-home', async () => {
  const { context, page } = await newPage()
  await page.goto(`${LOCAL}#home`)
  await page.locator('h1').first().waitFor()
  await shot(page, '01-home')
  await shot(page, '01-home-full', { full: true })
  await context.close()
})

await capture('02-packs', async () => {
  const { context, page } = await newPage()
  await page.goto(`${LOCAL}#packs`)
  await page.locator('h1').first().waitFor()
  await page.waitForTimeout(1500)
  await shot(page, '02-packs-expressions')
  await page.goto(`${LOCAL}#packs-words`)
  await page.waitForTimeout(1500)
  await shot(page, '03-packs-words')
  await context.close()
})

await capture('04-quiz', async () => {
  const { context, page } = await newPage()
  await page.goto(`${LOCAL}#words`)
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '뜻 보기' }).click()
  await shot(page, '04-review-quiz')
  await context.close()
})

await capture('05-journal-ai', async () => {
  const { context, page } = await newPage()
  await signIn(page)
  await page.route('https://example.supabase.co/functions/v1/correct-journal', (route) =>
    route.fulfill({ json: { feedback: journalFeedback, remaining: 4 } }),
  )
  await page.goto(`${AUTH}#journal`)
  await page.getByLabel('우리말로 쓰기').fill('오늘 연인이 너무 보고 싶어서 휴대폰만 계속 봤다.')
  await page.getByLabel('영어로 옮겨 보기').fill('I miss you very much today, so I see my phone again and again.')
  await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
  await page.locator('form .correction-panel').waitFor()
  await page.locator('form .correction-panel').scrollIntoViewIfNeeded()
  await page.waitForTimeout(5600) // 알림 문구가 사라진 뒤 찍는다
  await shot(page, '05-journal-ai')
  await context.close()
})

await capture('06-journal-drafts', async () => {
  const drafts = [
    { id: 'd1', savedAt: iso(0, 20), form: { mood: '', native: '내일 데이트 때 하고 싶은 말 정리', translation: 'Things I wanna say on our date tomorrow', aiFeedback: '', memo: '' } },
    { id: 'd2', savedAt: iso(1, 23), form: { mood: '', native: '처음 만난 날을 떠올리며 쓴 일기', translation: '', aiFeedback: '', memo: '' } },
  ]
  const { context, page } = await newPage({ extraStorage: { journalDrafts: drafts } })
  await page.goto(`${LOCAL}#journal`)
  await page.getByRole('heading', { name: '임시저장한 일기' }).scrollIntoViewIfNeeded()
  await shot(page, '06-journal-drafts')
  await context.close()
})

await capture('07-couple', async () => {
  const { context, page } = await newPage()
  const members = [
    { couple_id: 'p1', user_id: ME, nickname: '나', joined_at: '2026-11-01T00:00:00Z' },
    { couple_id: 'p1', user_id: PARTNER, nickname: 'Sunny', joined_at: '2026-11-01T00:00:00Z' },
  ]
  const sentences = [
    { id: 1, couple_id: 'p1', user_id: PARTNER, day: ymd(0), body: 'Can’t wait to see you this weekend!', lang: 'en', created_at: iso(0, 8) },
    { id: 2, couple_id: 'p1', user_id: ME, day: ymd(1), body: 'I miss you already.', lang: 'en', created_at: iso(1, 22) },
    { id: 3, couple_id: 'p1', user_id: PARTNER, day: ymd(1), body: 'You up? lol', lang: 'en', created_at: iso(1, 23) },
  ]
  await signIn(page, (url) => {
    if (url.includes('/couple_members')) return members
    if (url.includes('/couples')) return [{ id: 'p1', code: 'LOVE24', kind: 'partner' }]
    if (url.includes('/couple_sentences')) return sentences
    if (url.includes('/couple_reactions')) return []
    return null
  })
  await page.goto(`${AUTH}#couple`)
  await page.getByText('Can’t wait to see you this weekend!').first().waitFor()
  await shot(page, '07-couple')
  await context.close()
})

await capture('08-helper', async () => {
  const { context, page } = await newPage()
  await signIn(page, (url) => (url.includes('/pro_members') ? [{ user_id: ME }] : null))
  let reply = polishReply
  await page.route('https://example.supabase.co/functions/v1/correct-journal', (route) =>
    route.fulfill({ json: { feedback: reply, remaining: 19, pro: true } }),
  )
  await page.goto(`${AUTH}#helper`)
  await page.getByLabel('보내고 싶은 말').fill('오늘 하루 종일 네 생각만 했어')
  await page.getByRole('button', { name: '자연스럽게 다듬어 줘' }).click()
  await page.locator('.ai-result').waitFor()
  await page.locator('.ai-result').scrollIntoViewIfNeeded()
  await shot(page, '08-helper-polish')

  reply = explainReply
  await page.getByRole('button', { name: '받은 메시지 풀이' }).click()
  await page.getByLabel('받은 메시지').fill('ngl ur kinda cute lol')
  await page.getByRole('button', { name: '무슨 뜻인지 풀어 줘' }).click()
  await page.locator('.ai-result').waitFor()
  await page.locator('.ai-result').scrollIntoViewIfNeeded()
  await shot(page, '09-helper-explain')

  await page.goto(`${AUTH}#pro`)
  await page.getByText('Pro 회원이에요.', { exact: false }).waitFor()
  await shot(page, '10-pro-member', { full: true })
  await context.close()
})

await capture('10-pro', async () => {
  const { context, page } = await newPage()
  await page.goto(`${LOCAL}#pro`)
  await page.getByText('월 3,900원').waitFor()
  await shot(page, '10-pro')
  await shot(page, '10-pro-full', { full: true })
  await context.close()
})

await capture('11-settings', async () => {
  const { context, page } = await newPage()
  await page.goto(`${LOCAL}#settings`)
  await page.locator('h1').first().waitFor()
  await shot(page, '11-settings')
  await context.close()
})

await capture('12-dark', async () => {
  const { context, page } = await newPage({ dark: true })
  await page.goto(`${LOCAL}#home`)
  await page.locator('h1').first().waitFor()
  await shot(page, '12-dark-home')
  await page.goto(`${LOCAL}#journal`)
  await page.locator('h1').first().waitFor()
  await shot(page, '12-dark-journal')
  await context.close()
})

await capture('13-admin-pro', async () => {
  const { context, page } = await newPage()
  await signIn(page, (url) => {
    if (url.includes('/rpc/is_admin')) return true
    if (url.includes('/rpc/admin_list_pro'))
      return [
        { email: 'tester1@example.com', note: '학술제 시연', granted_at: iso(0) },
        { email: 'tester2@example.com', note: '', granted_at: iso(1) },
      ]
    return null
  })
  await page.goto(`${AUTH}#admin`)
  await page.getByRole('button', { name: 'Pro 회원' }).click()
  await page.getByText('tester1@example.com').waitFor()
  await shot(page, '13-admin-pro')
  await context.close()
})

await browser.close()
