import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const AUTH_URL = 'http://localhost:4174/'
const PAGES = [
  'home',
  'grammar',
  'missed',
  'words',
  'expressions',
  'chats',
  'journal',
  'profile',
  'settings',
  'privacy',
  'pro',
  'packs',
  'packs-words',
]

const seed = {
  savedWords: [
    {
      id: 'w1',
      createdAt: '2026-11-06T01:00:00Z',
      text: 'thoughtful',
      meaning: '사려 깊은, 배려하는',
      example: 'It was a thoughtful gift.',
    },
    { id: 'w2', createdAt: '2026-11-06T00:00:00Z', text: 'hang out', meaning: '어울려 놀다', example: '' },
  ],
  savedExpressions: [{ id: 'e1', createdAt: '2026-11-06T00:00:00Z', text: 'Me too!', meaning: '나도!', example: '' }],
  savedChats: [
    {
      id: 'c1',
      createdAt: '2026-11-06T00:00:00Z',
      situation: '친구가 안부를 물었을 때',
      message: 'How have you been?',
      meaning: '잘 지냈어?',
      category: 'daily',
      note: '자주 쓰는 인사',
    },
  ],
  savedJournals: [
    {
      id: 'j1',
      createdAt: '2026-11-05T00:00:00Z',
      native: '공원을 걸었다.',
      translation: 'I walked at the park.',
      memo: '',
      aiFeedback: 'in the park가 자연스러워요.',
    },
  ],
}

async function seedRecords(page) {
  await page.goto('/')
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
  }, seed)
}

// 첫 실행 안내는 따로 시험하고, 다른 시험에서는 이미 본 것으로 둔다.
test.beforeEach(async ({ page }, info) => {
  if (info.title.includes('첫 실행')) return
  await page.addInitScript(() => {
    try {
      localStorage.setItem('onboarded', '1')
    } catch {
      // 저장소를 막은 시험에서는 넘어간다.
    }
  })
})

async function navTo(page, name) {
  const item = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name, exact: true })
  if (await item.isVisible()) return item.click()
  await page.getByRole('button', { name: '더보기', exact: true }).click()
  await page.locator('.nav-more-sheet').getByRole('button', { name, exact: true }).click()
}

async function open(page, name) {
  await page.goto(`/?v=${name}#${name}`)
  await expect(page.locator('h1')).toBeVisible()
}

function watchErrors(page) {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test.describe('모든 화면', () => {
  for (const name of PAGES) {
    test(`${name}: 접근성, 콘솔, 가로 넘침`, async ({ page }, info) => {
      const errors = watchErrors(page)
      await seedRecords(page)
      await open(page, name)
      await page.evaluate(() => document.fonts.ready)

      if (name === 'chats') await page.getByRole('button', { name: /안부/ }).click()
      if (name === 'journal') await page.getByRole('button', { name: '자세히 보기' }).click()

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze()
      expect(violations.map((item) => `${item.id}: ${item.nodes[0].html}`)).toEqual([])

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow).toBe(false)
      expect(errors).toEqual([])
      await page.screenshot({
        path: `e2e-shots/${info.project.name}-${name}.png`,
        fullPage: true,
      })
    })
  }

  test('어두운 테마에서도 모든 화면의 글자 대비가 충분하다', async ({ page }) => {
    // 화면 8개를 차례로 검사해서, 병렬 실행 중에도 넉넉하게 시간을 준다.
    test.setTimeout(90_000)
    await page.emulateMedia({ colorScheme: 'dark' })
    await seedRecords(page)
    for (const name of PAGES) {
      await open(page, name)
      if (name === 'journal') await page.getByRole('button', { name: '자세히 보기' }).click()
      const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      expect(violations.map((item) => `${name} ${item.id}: ${item.nodes[0].html}`)).toEqual([])
    }
  })

  test('화면 테마를 고르면 바로 바뀌고 다시 열어도 유지된다', async ({ page }) => {
    await open(page, 'settings')
    await page.getByRole('radio', { name: '어둡게' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(await background()).toBe('rgb(58, 46, 41)')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('radio', { name: '기기 설정 따르기' }).check()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  })

  test('320px 폭에서도 가로로 넘치지 않는다', async ({ page }) => {
    await seedRecords(page)
    await page.setViewportSize({ width: 320, height: 640 })
    for (const name of PAGES) {
      await open(page, name)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, name).toBe(false)
    }
  })
})

test('단어 추가, 입력 오류, 수정, 삭제, 새로고침 유지', async ({ page }) => {
  await open(page, 'words')

  await page.getByRole('button', { name: '저장하기' }).click()
  await expect(page.getByLabel('단어 / 표현')).toBeFocused()
  await expect(page.getByLabel('단어 / 표현')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('여기를 채워 주세요.').first()).toBeVisible()

  await page.getByLabel('단어 / 표현').fill('run into')
  await page.getByLabel('뜻', { exact: true }).fill('우연히 마주치다')
  await page.getByRole('button', { name: '저장하기' }).dblclick()
  await expect(page.locator('.record-row')).toHaveCount(1)

  await page.getByRole('button', { name: '수정', exact: true }).click()
  await expect(page.getByLabel('단어 / 표현')).toHaveValue('run into')
  await page.getByLabel('뜻', { exact: true }).fill('딱 마주치다')
  await page.getByRole('button', { name: '수정 완료' }).click()
  await expect(page.locator('.record-row')).toContainText('딱 마주치다')

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords'))[0])
  expect(Object.keys(saved).sort()).toEqual(['createdAt', 'example', 'id', 'meaning', 'text'])

  await page.reload()
  await expect(page.locator('.record-row')).toHaveCount(1)

  // 지우면 되돌리기 버튼이 잠시 보이고, 누르면 같은 기록이 돌아온다.
  const remove = page.getByRole('button', { name: '삭제', exact: true })
  await remove.click()
  await expect(page.locator('.record-row')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '내 단어장' })).toBeFocused()
  await page.getByRole('button', { name: '되돌리기' }).click()
  await expect(page.locator('.record-row')).toContainText('딱 마주치다')
  await page.reload()
  await expect(page.locator('.record-row')).toHaveCount(1)

  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.locator('.record-row')).toHaveCount(0)
})

test('퀴즈를 끝까지 풀고 포커스가 결과로 간다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()

  // 뜻은 표현 방법이 여러 가지라, 카드를 뒤집어 보고 스스로 채점한다.
  for (let i = 0; i < 2; i += 1) {
    await expect(page.getByRole('button', { name: '뜻 보기' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.quiz-answer')).toBeVisible()
    await expect(page.getByRole('button', { name: '알았어요' })).toBeFocused()
    await page.keyboard.press('Enter')
  }

  await expect(page.getByRole('heading', { name: '다 풀었어요! 2개 중 2개 맞혔어요' })).toBeFocused()

  // 맞힌 단어는 다음 복습 날짜가 뒤로 밀려 오늘의 복습에서 빠진다.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')))
  expect(saved.every((word) => word.box === 1 && Date.parse(word.dueAt) > Date.now())).toBe(true)
  await page.getByRole('button', { name: '오늘 다시 보기' }).click()
  await expect(page.getByRole('heading', { name: /오늘 볼 건 다 봤어요/ })).toBeVisible()

  await open(page, 'home')
  // 단어는 모두 맞혀서 빠지고, 아직 복습하지 않은 표현 1개만 남는다.
  await expect(page.locator('.review-count')).toHaveText('1개')
  await expect(page.getByText('단어 0개 · 표현 1개')).toBeVisible()
  await expect(page.locator('.count').first()).toContainText('일째 이어 쓰는 중')
})

test('틀린 단어는 오늘 다시 묻는다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'home')
  await expect(page.locator('.review-count')).toHaveText('3개')
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '뜻 보기' }).click()
  await page.getByRole('button', { name: '헷갈렸어요' }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')))
  const wrong = saved.find((word) => word.box === 0)
  expect(Date.parse(wrong.dueAt)).toBeLessThanOrEqual(Date.now())
})

// 앱 안 AI 교정용 가짜 서버 함수. 보낸 요청문을 기억하고, 정해 둔 답을 차례로 돌려준다.
async function fakeAi(page, replies) {
  const prompts = []
  await page.route('https://example.supabase.co/functions/v1/correct-journal', async (route) => {
    prompts.push(route.request().postDataJSON().prompt)
    const feedback = replies[Math.min(prompts.length - 1, replies.length - 1)]
    return route.fulfill({ json: { feedback, remaining: 5 - prompts.length } })
  })
  return prompts
}

// 로그인한 상태로 일기 화면을 열고, AI 교정 동의는 이미 한 것으로 둔다.
async function openJournalSignedIn(page) {
  await fakeSession(page)
  await fakeReportServer(page)
  await page.addInitScript(() => localStorage.setItem('aiConsent', '1'))
  await page.goto(`${AUTH_URL}#journal`)
}

test('AI 교정은 앱 안에서 받고, 저장하면 지난 일기에서 나눠 보여 주며, 다음 요청에 연습할 점이 들어간다', async ({
  page,
}) => {
  const prompts = await fakeAi(page, [
    [
      '## 고친 문장',
      'I walked in the park yesterday.',
      '## 고칠 점',
      '- 원래: at the park → 고침: in the park | 이유: 공원 안을 걸었으니 in이 자연스러워요.',
      '## 더 자연스러운 표현',
      '- I took a walk in the park yesterday. | take a walk는 산책을 말할 때 더 일상적이에요.',
      '## 문법 포인트',
      '- 문법: 장소 전치사 in | 설명: 공간 안에 있을 때 써요. | 예문: I read a book in the library. | 해석: 나는 도서관에서 책을 읽었다.',
      '## 잘한 점',
      '과거형을 잘 썼어요.',
      '## 연습할 점',
      '장소 전치사 in과 at을 구분해 보세요.',
    ].join('\n'),
    '## 고친 문장\nI went to school today.\n## 잘한 점\n좋아요',
  ])
  await openJournalSignedIn(page)

  await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '모두 작성해' })).toBeVisible()
  expect(prompts).toHaveLength(0)

  await page.getByLabel('우리말로 쓰기').fill('어제 공원을 걸었다.')
  await page.getByLabel('영어로 옮겨 보기').fill('I walked at the park yesterday.')
  await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'AI 교정이 도착했어요.' })).toBeVisible()
  expect(prompts[0]).toContain('다정한 영어 튜터')
  expect(prompts[0]).toContain(
    '## 고친 문장\n## 고칠 점\n## 더 자연스러운 표현\n## 문법 포인트\n## 잘한 점\n## 연습할 점',
  )
  expect(prompts[0]).toContain('[일기]\n어제 공원을 걸었다.')
  expect(prompts[0]).toContain('[내 번역]\nI walked at the park yesterday.')

  // 다른 AI로 복사하거나 붙여 넣는 칸은 없다
  await expect(page.getByRole('button', { name: /복사|붙여 넣기/ })).toHaveCount(0)

  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await expect(page.getByLabel('우리말로 쓰기')).toHaveValue('')
  await page.getByRole('button', { name: '자세히 보기' }).click()
  const panel = page.locator('.journal-entry .correction-panel')
  await expect(panel.getByRole('heading', { name: '고친 문장' })).toBeVisible()
  await expect(panel.locator('ins')).toHaveText('in the park')
  await expect(panel.locator('del')).toHaveText('at the park')
  // 더 자연스러운 표현도 따로 보여 준다
  await expect(panel.getByRole('heading', { name: '더 자연스러운 표현' })).toBeVisible()
  await expect(panel).toContainText('I took a walk in the park yesterday.')
  // 문법 포인트를 문법 노트에 담으면 문법 탭에서 보인다
  await expect(panel.getByRole('heading', { name: '문법 포인트' })).toBeVisible()
  await panel.getByRole('button', { name: '장소 전치사 in 문법 노트에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '문법 노트에 담았어요.' })).toBeVisible()
  await navTo(page, '문법')
  await expect(page.locator('.record-row')).toContainText('장소 전치사 in')
  await expect(page.locator('.record-row')).toContainText('일기에서')
  await navTo(page, '오늘의 일기')

  // 다음 요청에는 지난번 연습할 점이 함께 들어간다.
  await page.getByLabel('우리말로 쓰기').fill('오늘 학교에 갔다.')
  await page.getByLabel('영어로 옮겨 보기').fill('I went to school today.')
  await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
  await expect(page.locator('form .correction-panel')).toContainText('I went to school today.')
  expect(prompts[1]).toContain('[참고: 지난 교정에서 연습하기로 한 점]\n- 장소 전치사 in과 at을 구분해 보세요.')
})

test('단어 카테고리: 기본 카테고리를 고르거나 직접 만들고, 목록을 카테고리로 거른다', async ({ page }) => {
  await open(page, 'words')
  const form = page.locator('form')
  await page.getByLabel('단어 / 표현').fill('crush')
  await page.getByLabel('뜻', { exact: true }).fill('짝사랑 상대')
  await form.locator('label', { hasText: '연애' }).click()
  await page.getByRole('button', { name: '저장하기' }).click()
  await expect(page.locator('.record-row')).toHaveCount(1)

  await page.getByLabel('단어 / 표현').fill('binge-watch')
  await page.getByLabel('뜻', { exact: true }).fill('몰아 보다')
  await page.getByRole('button', { name: '+ 카테고리 직접 만들기' }).click()
  await page.getByLabel('새 카테고리 이름').fill('K-드라마')
  await page.getByRole('button', { name: '만들기', exact: true }).click()
  await expect(form.getByRole('radio', { name: 'K-드라마' })).toBeChecked()
  await page.getByRole('button', { name: '저장하기' }).click()
  await expect(page.locator('.record-row')).toHaveCount(2)

  const filters = page.getByRole('group', { name: '카테고리로 거르기' })
  await filters.getByRole('button', { name: 'K-드라마' }).click()
  await expect(page.locator('.record-row')).toHaveCount(1)
  await expect(page.locator('.record-row')).toContainText('binge-watch')
  await filters.getByRole('button', { name: '전체' }).click()
  await expect(page.locator('.record-row')).toHaveCount(2)

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')))
  expect(saved.map((word) => word.category).sort()).toEqual(['K-드라마', 'love'])
})

test('문법 꾸러미: 주제별로 보고 담으면 문법 노트에서 연습할 수 있다', async ({ page }) => {
  await open(page, 'grammar')
  await page.getByRole('button', { name: '문법 꾸러미 둘러보기' }).click()
  await expect(page.getByRole('heading', { name: '문법 꾸러미', level: 1 })).toBeVisible()
  await expect(page.locator('.grammar-pack-card')).toHaveCount(8)
  await page.getByRole('group', { name: '문법 주제' }).getByRole('button', { name: '부탁·제안' }).click()
  await page.getByRole('button', { name: "Why don't we + 동사원형? 문법 노트에 담기" }).click()
  await expect(page.getByRole('status').filter({ hasText: '문법 노트에 담았어요.' })).toBeVisible()
  await page.getByRole('button', { name: '내 문법 노트로 가기' }).click()
  await expect(page.locator('.record-row')).toContainText("Why don't we + 동사원형?")
  await expect(page.locator('.record-row')).toContainText('꾸러미에서')
})

test('문법 노트: 문법을 적고, 번역으로 연습하고 채점하면 복습 일정에 남는다', async ({ page }) => {
  await open(page, 'grammar')
  await expect(page.getByRole('heading', { name: '문법 노트', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '문법 연습하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '먼저 문법을 하나 적어 주세요.' })).toBeVisible()

  await page.getByLabel('문법', { exact: true }).fill('used to + 동사원형')
  await page.getByLabel('설명', { exact: true }).fill('예전에는 ~하곤 했다')
  await page.getByLabel('예문 (선택)').fill('I used to play soccer.')
  await page.getByLabel('예문 해석').fill('나는 예전에 축구를 하곤 했다.')
  await page.getByRole('button', { name: '저장하기' }).click()
  await expect(page.locator('.record-row')).toContainText('used to + 동사원형')

  await page.getByRole('button', { name: '연습', exact: true }).click()
  const practice = page.getByRole('region', { name: '문법 연습' })
  await expect(practice.locator('.grammar-source')).toHaveText('나는 예전에 축구를 하곤 했다.')
  await practice.getByLabel('내 문장').fill('I used to playing soccer.')
  await practice.getByRole('button', { name: '모범 답 보기' }).click()
  await expect(practice.getByRole('status')).toContainText('I used to play soccer.')
  await practice.getByRole('button', { name: '작문' }).click()
  await expect(practice).toContainText('이 문법으로 내 이야기를 한 문장 지어 보세요.')
  await practice.getByRole('button', { name: '헷갈렸어요' }).click()
  await expect(practice).toContainText('다 풀었어요!')

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedGrammar'))[0])
  expect(saved).toMatchObject({ text: 'used to + 동사원형', box: 0, reviews: 1, misses: 1 })
})

test('일기 달력: 쓴 날을 누르면 그날 일기만 보이고, 전체 보기로 돌아온다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const now = new Date()
    const old = new Date(now)
    old.setDate(old.getDate() - 40)
    const entry = (id, date, native, mood) => ({
      id,
      createdAt: date.toISOString(),
      native,
      translation: '',
      memo: '',
      mood,
    })
    localStorage.setItem(
      'savedJournals',
      JSON.stringify([entry('j1', now, '오늘 쓴 일기', 'happy'), entry('j2', old, '예전에 쓴 일기', '')]),
    )
  })
  await open(page, 'journal')
  const list = page.locator('.journal-entry')
  await expect(list).toHaveCount(2)
  const today = page.getByRole('button', { name: /일기 1개$/ })
  await expect(today).toHaveCount(1)
  await today.click()
  await expect(today).toHaveAttribute('aria-pressed', 'true')
  await expect(list).toHaveCount(1)
  await expect(list.first()).toContainText('오늘 쓴 일기')

  await page.getByRole('button', { name: '전체 보기' }).click()
  await expect(list).toHaveCount(2)

  // 달을 넘기면 제목이 바뀌고, 다시 돌아오면 오늘 쓴 날이 보인다
  const title = page.locator('.calendar-head h3')
  const thisMonth = await title.textContent()
  await page.getByRole('button', { name: '이전 달' }).click()
  await expect(title).not.toHaveText(thisMonth)
  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(title).toHaveText(thisMonth)
  await expect(page.getByRole('button', { name: /일기 1개$/ })).toHaveCount(1)
})

test('일기: 오늘 기분을 영어로 고르고, 교정의 고칠 점을 표현 모음에 담아 복습한다', async ({ page }) => {
  await fakeAi(page, [
    [
      '## 고친 문장',
      'Today I went to a cafe with my friend.',
      '## 고칠 점',
      '- 원래: go → 고침: went | 이유: 이미 한 일이라 과거형을 써요.',
      '- 원래: with friend → 고침: with my friend | 이유: my를 붙이면 자연스러워요.',
      '## 잘한 점',
      '짧고 분명해요.',
      '## 연습할 점',
      '과거형 연습',
    ].join('\n'),
  ])
  await openJournalSignedIn(page)

  // 기분을 고르면 그 낱말을 쓴 예문이 보이고, 단어장에 담을 수 있다.
  const tired = page.locator('.mood-chips').getByRole('button', { name: /^tired/ })
  await tired.click()
  await expect(tired).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('I was so tired today.')).toBeVisible()
  await page.getByRole('button', { name: 'tired 단어장에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '"tired"를 단어장에 담았어요.' })).toBeVisible()

  await page.getByLabel('우리말로 쓰기').fill('오늘 친구랑 카페에 갔다.')
  await page.getByLabel('영어로 옮겨 보기').fill('Today I go to cafe with friend.')
  await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'AI 교정이 도착했어요.' })).toBeVisible()
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await expect(page.locator('.journal-entry .mood-tag')).toHaveText('tired · 피곤한')

  await page.getByRole('button', { name: '자세히 보기' }).click()
  await page.getByRole('button', { name: 'with my friend 내 표현 모음에 담기' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: '"with my friend"를 내 표현 모음에 담았어요.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'with my friend 이미 담음' })).toBeDisabled()

  // 표현 모음에서는 원래 쓴 말과 이유를 보고 고친 말을 떠올린다.
  await navTo(page, '표현 모음')
  await expect(page.locator('.record-row')).toContainText('원래 쓴 말: with friend')
  await page.getByRole('button', { name: '표현 퀴즈' }).click()
  await expect(page.locator('.quiz-question')).toHaveText('원래 쓴 말: with friend · my를 붙이면 자연스러워요.')
  await page.getByLabel('생각나는 대로 써 보세요').fill('with my friend')
  await page.keyboard.press('Enter')
  await expect(page.getByText('맞았어요!')).toBeVisible()
})

test('일기에 쓴 내 표현과 오늘의 표현을 찾고, 홈의 도장과 이번 주 돌아보기에 모은다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'journal')

  // 오늘의 표현은 날마다 바뀌므로 화면에 보이는 표현을 읽어 그대로 써 본다.
  const mission = page.locator('.today-mission')
  await expect(mission).toContainText('오늘의 표현, 일기에 한번 써 볼까요?')
  const phrase = (await mission.locator('b').textContent()).replace(/[.!?]+$/, '')

  await page
    .locator('.mood-chips')
    .getByRole('button', { name: /^happy/ })
    .click()
  await page.getByLabel('우리말로 쓰기').fill('친구들이랑 놀았다.')
  await page.getByLabel('영어로 옮겨 보기').fill(`I hang out with my friends. ${phrase}.`)
  await expect(page.locator('.usage-box .usage-line')).toContainText('hang out')
  await expect(mission).toHaveClass(/done/)
  await expect(mission).toContainText('오늘의 표현을 썼어요!')
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await expect(page.locator('.journal-entry').first().locator('.usage-line')).toContainText('hang out')

  await open(page, 'home')
  await expect(page.locator('.mission-row')).toHaveClass(/done/)
  await expect(page.locator('.week-strip li.today .stamp')).toHaveClass(/mood-good/)
  await expect(page.locator('.week-moods')).toContainText('happy')

  const recap = page.locator('.recap-card')
  await expect(recap.locator('.recap-chips')).toContainText('hang out')
  await expect(recap.locator('.recap-moods')).toContainText('happy')
  const downloadPromise = page.waitForEvent('download')
  await recap.getByRole('button', { name: '이미지로 저장' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^daily-english-\d{4}-\d{2}-\d{2}\.png$/)
})

test('첫 실행 안내: 단계를 고르고, 표현을 담고, 기분과 한 줄 일기로 시작한다', async ({ page }) => {
  await open(page, 'home')
  await expect(page.getByRole('heading', { name: '어디서부터 시작할까요?' })).toBeFocused()
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(violations.map((item) => `${item.id}: ${item.nodes[0].html}`)).toEqual([])

  await page.getByRole('button', { name: /^중급/ }).click()
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '마음에 드는 표현을 담아 보세요' })).toBeFocused()
  await page.getByRole('button', { name: /^hang out/ }).click()
  await page.getByRole('button', { name: /^Pretty good/ }).click()
  await expect(page.getByText('2개 골랐어요')).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '오늘 기분을 고르고 한 줄 써 볼까요?' })).toBeFocused()
  await page
    .locator('.mood-chips')
    .getByRole('button', { name: /^happy/ })
    .click()
  await page.getByRole('button', { name: '첫 일기 저장하고 시작하기' }).click()
  await expect(page.getByText('여기를 채워 주세요.')).toBeVisible()
  await page.getByLabel('오늘 한 줄 (우리말)').fill('친구들이랑 놀았다.')
  await page.getByLabel('영어로 한 줄 (선택)').fill('I hang out with my friends today.')
  await expect(page.locator('.onboarding .usage-line')).toContainText('hang out')
  await page.getByRole('button', { name: '첫 일기 저장하고 시작하기' }).click()

  await expect(page.getByRole('status').filter({ hasText: '준비 끝!' })).toBeVisible()
  await expect(page.locator('.week-moods')).toContainText('happy')
  await expect(page.locator('.recap-chips')).toContainText('hang out')

  // 한 번 본 안내는 다시 뜨지 않고, 고른 단계부터 단어 꾸러미를 보여 준다.
  await page.reload()
  await expect(page.locator('.onboarding')).toHaveCount(0)
  await open(page, 'packs-words')
  await expect(page.getByRole('button', { name: '중급' })).toHaveAttribute('aria-pressed', 'true')
})

test('첫 실행 안내는 건너뛸 수 있고 다시 뜨지 않는다', async ({ page }) => {
  await open(page, 'home')
  await page.getByRole('button', { name: '나중에 할게요' }).click()
  await expect(page.locator('.onboarding')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '오늘의 표현' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.onboarding')).toHaveCount(0)
})

test('타이핑 문제는 괄호 설명을 무시하고, 틀려도 "제 답도 맞아요"로 바꿀 수 있다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '뜻 → 표현' }).click()
  const question = await page.locator('.quiz-question').textContent()
  await page.getByLabel('생각나는 대로 써 보세요').fill('틀린 답')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/아깝다/)).toBeVisible()
  await page.getByRole('button', { name: '제 답도 맞아요' }).click()
  await expect(page.getByText('맞았어요!')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.quiz-progress')).toContainText('맞힌 개수 1')
  expect(question).toBeTruthy()
})

async function seedWords(page, count) {
  await page.goto('/')
  await page.evaluate((n) => {
    const words = Array.from({ length: n }, (_, i) => ({
      id: `w${i}`,
      text: `word${i}`,
      meaning: `뜻${i}`,
      example: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    localStorage.setItem('savedWords', JSON.stringify(words))
  }, count)
}

test('객관식: 뜻이 4개 미만이면 안내하고, 충분하면 보기를 골라 풀 수 있다', async ({ page }) => {
  await seedWords(page, 3)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '객관식' }).click()
  await expect(page.getByText(/뜻이 4개 이상/)).toBeVisible()

  await seedWords(page, 5)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '객관식' }).click()
  await expect(page.locator('.quiz-choice')).toHaveCount(4)

  // 문제마다 정답 뜻은 "뜻" + 단어 번호다.
  const word = (await page.locator('.quiz-question').textContent()).trim()
  const right = `뜻${word.replace('word', '')}`
  await page.locator('.quiz-choice', { hasText: right }).click()
  await expect(page.getByText('맞았어요!')).toBeVisible()
  await expect(page.locator('.quiz-choice').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: '다음 문제' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.quiz-progress')).toContainText('2 / 5')
  await expect(page.locator('.quiz-progress')).toContainText('맞힌 개수 1')
})

test('듣고 쓰기: 읽어 주는 말을 쓰면 맞힌 것으로 센다', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spoken = []
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text
    }
    Object.defineProperty(window, 'speechSynthesis', {
      value: { cancel() {}, speak: (utterance) => window.__spoken.push(utterance.text) },
      configurable: true,
    })
  })
  await seedWords(page, 2)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '듣고 쓰기' }).click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0)
  const heard = await page.evaluate(() => window.__spoken.at(-1))
  await page.getByLabel('생각나는 대로 써 보세요').fill(heard)
  await page.keyboard.press('Enter')
  await expect(page.getByText('맞았어요!')).toBeVisible()
  await page.getByRole('button', { name: '다시 듣기' }).click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(1)
})

test('헷갈리는 말: 홈에서 들어가 많이 틀린 순으로 보고, 그 말들만 다시 풀면 틀린 횟수가 쌓인다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const base = { example: '', createdAt: '2026-01-01T00:00:00.000Z', dueAt: '2026-01-02T00:00:00.000Z' }
    const words = [
      { ...base, id: 'a', text: 'often', meaning: '자주 틀림', box: 0, reviews: 4, misses: 3 },
      { ...base, id: 'b', text: 'once', meaning: '한 번 틀림', box: 1, reviews: 2, misses: 1 },
      { ...base, id: 'c', text: 'fine', meaning: '안 틀림', box: 2, reviews: 2, misses: 0 },
      { ...base, id: 'd', text: 'settled', meaning: '익숙해짐', box: 4, reviews: 9, misses: 5 },
    ]
    localStorage.setItem('savedWords', JSON.stringify(words))
  })
  await open(page, 'home')
  await page.getByRole('button', { name: '헷갈리는 말 2개 보기' }).click()
  await expect(page.getByRole('heading', { name: '헷갈리는 말', exact: true })).toBeVisible()
  const rows = page.locator('.missed-list li')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('often')
  await expect(rows.first()).toContainText('복습 4번 중 3번 틀렸어요')
  await expect(page.locator('.missed-list')).not.toContainText('settled')

  await page.getByRole('button', { name: '이 말들만 퀴즈 풀기' }).click()
  await page.getByRole('button', { name: '뜻 보기' }).click()
  await page.getByRole('button', { name: '헷갈렸어요' }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')))
  const touched = saved.filter((word) => word.misses > 0 && word.lastReviewedAt)
  expect(touched).toHaveLength(1)
  expect(touched[0].reviews).toBe(touched[0].id === 'a' ? 5 : 3)
  expect(touched[0].misses).toBe(touched[0].id === 'a' ? 4 : 2)
})

test('헷갈리는 말이 없으면 안내하고, 홈에는 링크가 없다', async ({ page }) => {
  await seedWords(page, 2)
  await open(page, 'home')
  await expect(page.getByRole('button', { name: /헷갈리는 말/ })).toHaveCount(0)
  await page.goto('/#missed')
  await expect(page.getByText('지금 헷갈리는 말이 없어요')).toBeVisible()
})

test('단어를 직접 넣을 때 꾸러미에 있는 말이면 뜻과 예문을 한 번에 채운다', async ({ page }) => {
  await open(page, 'words')
  await page.getByLabel('단어 / 표현').fill('tired')
  await page.getByRole('button', { name: '꾸러미 뜻 채우기' }).click()
  await expect(page.getByLabel('뜻', { exact: true })).toHaveValue(/피곤한/)
  await expect(page.getByLabel('예문')).not.toHaveValue('')
  await expect(page.getByRole('button', { name: '꾸러미 뜻 채우기' })).toHaveCount(0)
})

test('쓰던 일기는 기기 저장소에 남는다', async ({ page }) => {
  await open(page, 'journal')
  await page.getByLabel('우리말로 쓰기').fill('쓰다 만 일기')
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('journalDraft'))?.native))
    .toBe('쓰다 만 일기')
  await page.reload()
  await expect(page.getByLabel('우리말로 쓰기')).toHaveValue('쓰다 만 일기')
})

test('기록이 이 기기에만 쌓이면 백업을 한 번 권하고, 다음에를 누르면 조용해진다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const words = Array.from({ length: 10 }, (_, index) => ({
      id: `0b5f3f0e-8f8d-4c6e-9a43-3f1c2f0a1e${String(index).padStart(2, '0')}`,
      createdAt: new Date().toISOString(),
      text: `word${index}`,
      meaning: `뜻${index}`,
      example: '',
    }))
    localStorage.setItem('savedWords', JSON.stringify(words))
  })
  await open(page, 'home')
  await expect(page.locator('.backup-nudge')).toContainText('기록 10개가 이 기기에만 있어요.')
  await page.getByRole('button', { name: '다음에' }).click()
  await expect(page.locator('.backup-nudge')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.backup-nudge')).toHaveCount(0)
})

test('앱에서 난 오류는 설정의 앱 오류 기록에 남는다', async ({ page }) => {
  await open(page, 'settings')
  await expect(page.getByText('지금까지 기록된 오류가 없어요.')).toBeVisible()
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error('시험용 오류')
    }),
  )
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('errorLog') ?? '[]').length)).toBe(1)
  await page.reload()
  await expect(page.locator('.error-log')).toContainText('시험용 오류')
  await page.getByRole('button', { name: '지우기' }).click()
  await expect(page.getByText('지금까지 기록된 오류가 없어요.')).toBeVisible()
})

test('알림: 하루 목표를 정하고 알림을 켜면 다음 알림이 보이고, 홈에 목표 진행이 나온다', async ({ page, context }) => {
  await context.grantPermissions(['notifications'])
  await open(page, 'settings')
  await page.getByRole('radio', { name: '하루 3개' }).check()
  await page.getByRole('switch', { name: /목표를 못 채운 날/ }).click()
  await expect(page.getByRole('switch', { name: /목표를 못 채운 날/ })).toBeChecked()
  await expect(page.getByText(/다음 알림: .*\(하루 목표\)/)).toBeVisible()
  await expect(page.getByText('웹에서는 이 탭이나 설치한 웹앱이 열려 있을 때만', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('reminders')))).toMatchObject({
    goal: 3,
    goalReminder: true,
  })

  await open(page, 'home')
  await expect(page.locator('.goal-progress')).toContainText('오늘 목표 0 / 3')
  await expect(page.getByRole('progressbar', { name: '오늘 목표' })).toHaveAttribute('aria-valuenow', '0')
})

test('메뉴에서 꾸러미로 바로 간다(휴대폰은 더보기에서)', async ({ page }, info) => {
  await open(page, 'home')
  await navTo(page, '꾸러미')
  await expect(page.getByRole('heading', { name: '표현 꾸러미', level: 1 })).toBeVisible()
  // PC는 왼쪽 메뉴의 꾸러미가, 휴대폰은 아래 탭의 더보기가 지금 화면을 가리킨다.
  const current =
    info.project.name === 'mobile'
      ? page.getByRole('button', { name: '더보기', exact: true })
      : page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '꾸러미' })
  await expect(current).toHaveAttribute('aria-current', 'page')
  if (info.project.name === 'mobile') {
    // 더보기는 열면 목록이 보이고, Esc로 닫힌다.
    await page.getByRole('button', { name: '더보기', exact: true }).click()
    await expect(page.locator('.nav-more-sheet')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.nav-more-sheet')).toHaveCount(0)
  }
})

test('빈칸 채우기: 예문이 있는 단어만 내고, 예문 속 형태로 답한다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '빈칸 채우기' }).click()

  // 예문이 있는 thoughtful만 나오고, 예문이 없는 hang out은 빠진다.
  await expect(page.locator('.quiz-question')).toHaveText('It was a ____(빈칸) gift.')
  await expect(page.getByText('뜻: 사려 깊은, 배려하는')).toBeVisible()
  await page.getByLabel('생각나는 대로 써 보세요').fill('thoughtful')
  await page.keyboard.press('Enter')
  await expect(page.getByText('맞았어요!')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '다 풀었어요! 1개 중 1개 맞혔어요' })).toBeFocused()
})

test('AI 교정이 정해진 형식이 아니어도 지난 일기에서 그대로 보여 준다', async ({ page }) => {
  await fakeAi(page, ['at the park 대신 in the park가 자연스러워요.'])
  await openJournalSignedIn(page)
  await page.getByLabel('우리말로 쓰기').fill('어제 공원을 걸었다.')
  await page.getByLabel('영어로 옮겨 보기').fill('I walked at the park yesterday.')
  await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'AI 교정이 도착했어요.' })).toBeVisible()
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await page.getByRole('button', { name: '자세히 보기' }).click()
  await expect(page.locator('.journal-entry .feedback-raw')).toHaveText('at the park 대신 in the park가 자연스러워요.')
})

test('원본 앱 형식으로 남은 기록도 읽는다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('savedWords', JSON.stringify([{ id: 1731400000000, word: 'legacy word', meaning: '옛 단어' }]))
    localStorage.setItem(
      'savedJournals',
      JSON.stringify([{ id: 1731400000001, nativeText: '옛 일기', translation: 'old', note: '' }]),
    )
  })
  await open(page, 'words')
  await expect(page.locator('.record-row')).toContainText('legacy word')
  await open(page, 'journal')
  await expect(page.locator('.journal-entry')).toContainText('옛 일기')
})

test('작성 중인 일기는 새로고침해도 남는다', async ({ page }) => {
  await open(page, 'journal')
  await page.getByLabel('우리말로 쓰기').fill('아직 다 못 쓴 일기')
  await page.reload()
  await expect(page.getByLabel('우리말로 쓰기')).toHaveValue('아직 다 못 쓴 일기')
})

test('대화 펼치기 상태를 보조 기술에 알린다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'chats')
  const summary = page.getByRole('button', { name: /안부/ })
  await expect(summary).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('How have you been?')).toBeHidden()
  await summary.click()
  await expect(summary).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('How have you been?')).toBeVisible()
})

test('키보드: 바로가기, 페이지 이동 포커스, 탭 제목', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', '키보드 흐름은 PC에서만 본다')
  await open(page, 'home')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '본문으로 바로가기' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()

  await navTo(page, '단어장')
  await expect(page.locator('main')).toBeFocused()
  await expect(page).toHaveTitle('단어장 · Daily English')
})

test('언어를 바꾸면 화면과 html lang이 바뀐다', async ({ page }) => {
  await open(page, 'settings')
  await page.getByRole('group', { name: '내 언어' }).getByRole('radio', { name: '영어' }).check()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
})

test('내보내기와 전체 삭제', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'settings')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '내 기록 내려받기' }).click()
  expect((await download).suggestedFilename()).toMatch(/^daily-english-.*\.json$/)

  await page.getByRole('button', { name: '모든 기록 삭제' }).click()
  await page.getByRole('button', { name: /정말 삭제할까요/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '모든 기록을 삭제했어요' })).toBeVisible()
  const words = await page.evaluate(() => localStorage.getItem('savedWords'))
  expect(words).toBe('[]')
})

test('내려받은 백업 파일로 지운 기록을 되살린다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'settings')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '내 기록 내려받기' }).click()
  const backupPath = await (await download).path()

  await page.getByRole('button', { name: '모든 기록 삭제' }).click()
  await page.getByRole('button', { name: /정말 삭제할까요/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '모든 기록을 삭제했어요' })).toBeVisible()

  const fileInput = page.getByLabel('파일에서 가져오기')
  await fileInput.setInputFiles(backupPath)
  const plan = page.getByRole('region', { name: '가져올 기록' })
  await expect(plan).toContainText('단어 2개 · 표현 1개 · 대화 1개 · 일기 1개 · 문법 0개를 더해요.')
  await plan.getByRole('button', { name: '5개 가져오기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '기록 5개를 가져왔어요.' })).toBeVisible()
  await expect(plan).toBeHidden()

  // 같은 파일을 다시 가져오면 이미 있는 기록이라 건너뛴다.
  await fileInput.setInputFiles(backupPath)
  await expect(plan).toContainText('새로 가져올 기록이 없어요.')
  await expect(plan).toContainText('이미 있는 기록 5개는 건너뛰어요.')
  await plan.getByRole('button', { name: '취소' }).click()

  await open(page, 'words')
  await expect(page.locator('.record-row')).toHaveCount(2)
  await expect(page.locator('.record-row').first()).toContainText('thoughtful')
})

test('백업 파일이 아니면 가져오지 않고 알려 준다', async ({ page }) => {
  await open(page, 'settings')
  await page.getByLabel('파일에서 가져오기').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  })
  await expect(page.getByRole('status').filter({ hasText: '이 앱의 백업 파일이 아니에요.' })).toBeVisible()
  await expect(page.getByRole('region', { name: '가져올 기록' })).toHaveCount(0)
})

test('표현 꾸러미에서 담은 표현이 내 표현 모음에 들어가고 복습할 수 있다', async ({ page }) => {
  await open(page, 'home')
  // 처음 쓰는 사람도 홈에서 오늘의 표현을 바로 담을 수 있다.
  await expect(page.getByRole('heading', { name: '오늘의 표현' })).toBeVisible()
  await expect(page.getByText('처음이라면 오늘의 표현부터 담아 보세요.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '꾸러미 더 보기' }).click()
  await expect(page.getByRole('heading', { name: '표현 꾸러미', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: '감정·관계' }).click()
  await expect(page.getByRole('button', { name: '감정·관계' })).toHaveAttribute('aria-pressed', 'true')
  const card = page.locator('.expression-card').filter({ hasText: 'hang out' })
  await expect(card).toHaveCount(0)
  await page.getByRole('button', { name: '일상 대화' }).click()
  await page
    .locator('.expression-card')
    .filter({ hasText: 'hang out' })
    .getByRole('button', { name: 'hang out 내 표현 모음에 담기' })
    .click()
  await expect(page.getByRole('status').filter({ hasText: '"hang out"를 내 표현 모음에 담았어요.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'hang out 이미 담음' })).toBeDisabled()
  await expect(page.locator('.pack-panel .count')).toHaveText('1 / 40 담음')
  await expect(page.getByText('Tatoeba')).toBeVisible()

  await open(page, 'expressions')
  await expect(page.locator('.record-row')).toContainText('hang out')
  await expect(page.locator('.record-row')).toContainText('어울려 놀다')
  await expect(page.getByText('오늘 다시 볼 말 1개')).toBeVisible()
})

test('단어 꾸러미: 단계와 범위를 골라 담은 단어가 단어장에 들어간다', async ({ page }) => {
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 꾸러미에서 고르기' }).click()
  await expect(page.getByRole('heading', { name: '단어 꾸러미', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: '단어 600개' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '초급' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.pack-panel .expression-card')).toHaveCount(50)

  await page.getByRole('button', { name: '51–100' }).click()
  // Tatoeba 예문에는 문장 번호 링크가 있고, 직접 쓴 예문(money)에는 없다.
  const card = page
    .locator('.expression-card')
    .filter({ has: page.getByRole('heading', { name: 'school', exact: true }) })
  await expect(card.getByRole('link', { name: /Tatoeba #\d+ 예문 원문 보기/ })).toBeVisible()
  const ownCard = page
    .locator('.expression-card')
    .filter({ has: page.getByRole('heading', { name: 'money', exact: true }) })
  await expect(ownCard.getByRole('link')).toHaveCount(0)
  await card.getByRole('button', { name: 'school 단어장에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '"school"를 단어장에 담았어요.' })).toBeVisible()
  await expect(page.locator('.pack-panel .count')).toHaveText('1 / 300 담음')

  // 중급으로 바꾸면 범위가 처음으로 돌아간다.
  await page.getByRole('button', { name: '중급' }).click()
  await expect(page.getByRole('button', { name: '1–50' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '표현 589개' }).click()
  await expect(page.getByRole('heading', { name: '표현 꾸러미', level: 1 })).toBeVisible()

  await open(page, 'words')
  await expect(page.locator('.record-row')).toContainText('school')
})

test('Pro 시연판: 미리 보기를 켜면 내 기록으로 만든 통계가 보인다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'pro')
  await expect(page.getByText('발표용 시연판 · 결제 기능 없음')).toBeVisible()
  await expect(page.getByText('Pro 미리 보기를 켜면')).toBeVisible()

  await page.getByRole('button', { name: 'Pro 미리 보기 켜기' }).click()
  const tile = (label) => page.locator('.stat-tile').filter({ hasText: label }).locator('.stat-value')
  await expect(tile('모은 기록')).toHaveText('5')
  await page.locator('.chart').first().getByText('표로 보기').click()
  await expect(page.locator('.chart').first().locator('tbody tr')).toHaveCount(28)

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(violations.map((item) => `${item.id}: ${item.nodes[0].html}`)).toEqual([])

  // 다시 열어도 미리 보기 상태가 유지된다.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pro 미리 보기 끄기' })).toHaveAttribute('aria-pressed', 'true')
})

test('브라우저 저장소가 막혀도 앱이 멈추지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요')
  await expect(page.locator('h1')).toBeVisible()
})

test('보안 헤더와 메타 태그', async ({ page, request }) => {
  const response = await request.get('/')
  const headers = response.headers()
  expect(headers['content-security-policy']).toContain("default-src 'self'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')

  const html = await response.text()
  expect(html).toContain('<h1>Daily English</h1>')
  expect(html).toContain('rel="manifest"')
  expect(html).not.toContain('cdn.jsdelivr.net')

  expect((await request.get('/robots.txt')).status()).toBe(200)
  await page.goto('/')
  await expect(page).toHaveTitle('홈 · Daily English')
})

// 테스트용 가짜 로그인 세션. 값은 Supabase 클라이언트가 브라우저 저장소에서 읽는 형식이다.
async function fakeSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-example-auth-token',
      JSON.stringify({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'learner@example.com',
          user_metadata: { nickname: 'Tester' },
        },
      }),
    )
  })
  await page.route('https://example.supabase.co/auth/v1/**', (route) => route.fulfill({ json: {} }))
}

// 신고·관리자 기능용 가짜 Supabase. 받은 요청을 기억해 두고, 표마다 돌려줄 행을 정한다.
async function fakeReportServer(page, { admin = false, errors = [] } = {}) {
  const reports = []
  const patches = []
  const fixes = []
  const records = new Map()
  await page.route('https://example.supabase.co/rest/v1/**', async (route) => {
    const request = route.request()
    const url = request.url()
    if (url.includes('/rpc/is_admin')) return route.fulfill({ json: admin })
    if (url.includes('/study_records')) {
      if (request.method() === 'POST') {
        for (const row of [request.postDataJSON()].flat()) records.set(row.id, row)
        return route.fulfill({ status: 201, json: [] })
      }
      if (request.method() === 'DELETE') {
        records.delete(new URL(url).searchParams.get('id')?.replace('eq.', ''))
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ json: [...records.values()] })
    }
    if (url.includes('/pack_fixes')) {
      if (request.method() === 'POST') {
        const row = { ...request.postDataJSON(), updated_at: new Date().toISOString() }
        const at = fixes.findIndex((fix) => fix.item_id === row.item_id)
        if (at >= 0) fixes.splice(at, 1)
        fixes.unshift(row)
        return route.fulfill({ status: 201, json: [] })
      }
      if (request.method() === 'DELETE') {
        const id = new URL(url).searchParams.get('item_id')?.replace('eq.', '')
        fixes.splice(0, fixes.length, ...fixes.filter((fix) => fix.item_id !== id))
        return route.fulfill({ status: 204, body: '' })
      }
      const kind = new URL(url).searchParams.get('kind')?.replace('eq.', '')
      return route.fulfill({ json: fixes.filter((fix) => !kind || fix.kind === kind) })
    }
    if (url.includes('/client_errors'))
      return route.fulfill(request.method() === 'GET' ? { json: errors } : { status: 201, json: [] })
    if (url.includes('/reports')) {
      if (request.method() === 'POST') {
        const row = request.postDataJSON()
        reports.unshift({
          id: reports.length + 1,
          created_at: new Date().toISOString(),
          status: 'new',
          admin_reply: '',
          ...row,
        })
        return route.fulfill({ status: 201, json: [] })
      }
      if (request.method() === 'PATCH') {
        patches.push(request.postDataJSON())
        Object.assign(reports[0], request.postDataJSON())
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ json: reports })
    }
    return route.fulfill(request.method() === 'GET' ? { json: [] } : { status: 201, json: [] })
  })
  return { reports, patches, fixes }
}

test.describe('로그인 화면', () => {
  test('로그인한 사용자는 문제를 신고하고, 보낸 신고와 상태를 설정에서 본다', async ({ page }) => {
    await fakeSession(page)
    const server = await fakeReportServer(page)
    await page.goto(`${AUTH_URL}#settings`)
    await page.getByRole('radio', { name: '단어·예문이 틀렸어요' }).check()
    await page.getByRole('button', { name: '보내기' }).click()
    await expect(page.getByText('여기를 채워 주세요.')).toBeVisible()
    await page.getByLabel('자세히 알려 주세요').fill('tired의 예문 번역이 어색해요.')
    await page.getByRole('button', { name: '보내기' }).click()
    await expect(page.getByRole('status').filter({ hasText: '잘 받았어요' })).toBeVisible()
    expect(server.reports[0]).toMatchObject({
      kind: 'content',
      message: 'tired의 예문 번역이 어색해요.',
      platform: 'web',
    })
    await expect(page.locator('.report-list')).toContainText('tired의 예문 번역이 어색해요.')
    await expect(page.locator('.report-list .report-status')).toHaveText('접수')
    await expect(page.getByRole('link', { name: '관리자 페이지' })).toHaveCount(0)
  })

  test('관리자는 관리자 페이지에서 신고를 보고 상태와 답변을 바로 고치고, 앱 오류를 묶어 본다', async ({ page }) => {
    await fakeSession(page)
    const errors = [
      {
        created_at: '2026-11-19T01:00:00Z',
        source: 'window',
        message: 'TypeError: x is undefined',
        page: 'journal',
        version: '0.0.0',
        platform: 'android',
        count: 2,
      },
      {
        created_at: '2026-11-19T02:00:00Z',
        source: 'window',
        message: 'TypeError: x is undefined',
        page: 'journal',
        version: '0.0.0',
        platform: 'web',
        count: 1,
      },
    ]
    const server = await fakeReportServer(page, { admin: true, errors })
    server.reports.push({
      id: 7,
      created_at: '2026-11-19T03:00:00Z',
      kind: 'bug',
      message: '복습 버튼이 안 눌려요',
      page: 'home',
      version: '0.0.0',
      platform: 'android',
      error_log: '',
      status: 'new',
      admin_reply: '',
    })

    await page.goto(`${AUTH_URL}#settings`)
    await page.getByRole('link', { name: '관리자 페이지' }).click()
    await expect(page.getByRole('heading', { name: '관리자', level: 1 })).toBeVisible()
    const item = page.locator('.admin-item').filter({ hasText: '복습 버튼이 안 눌려요' })
    await item.getByLabel('상태').selectOption('fixed')
    await item.getByLabel('답변').fill('다음 버전에서 고쳤어요.')
    await item.getByRole('button', { name: '저장' }).click()
    await expect(page.getByRole('status').filter({ hasText: '신고를 고쳤어요.' })).toBeVisible()
    expect(server.patches[0]).toEqual({ status: 'fixed', admin_reply: '다음 버전에서 고쳤어요.' })
    await expect(item.locator('.report-status')).toHaveText('해결')

    await page.getByRole('button', { name: '앱 오류' }).click()
    await expect(page.locator('.admin-item')).toHaveCount(1)
    await expect(page.locator('.admin-item')).toContainText('3번')
    await expect(page.locator('.admin-item')).toContainText('android, web')

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([])
  })

  test('관리자는 꾸러미의 틀린 뜻을 바로 고치고, 사용자 화면에 반영되며, 원래대로 되돌릴 수 있다', async ({ page }) => {
    await fakeSession(page)
    const server = await fakeReportServer(page, { admin: true })
    server.reports.push({
      id: 9,
      created_at: '2026-11-19T03:00:00Z',
      kind: 'content',
      message: 'tired 뜻이 이상해요',
      page: 'words',
      version: '0.0.0',
      platform: 'web',
      error_log: '',
      status: 'new',
      admin_reply: '',
    })

    await page.goto(`${AUTH_URL}#admin`)
    await page
      .locator('.admin-item')
      .filter({ hasText: 'tired 뜻이 이상해요' })
      .getByRole('button', { name: '꾸러미 고치기로' })
      .click()
    await expect(page.getByRole('heading', { name: '꾸러미 고치기', level: 2 })).toBeVisible()
    await page.getByLabel('고칠 단어·표현 찾기').fill('tired')
    await page.getByRole('button', { name: 'tired 고치기', exact: true }).click()
    await page.getByLabel('뜻', { exact: true }).fill('피곤한, 지친 (고침)')
    await page.getByLabel('메모(관리자만 봐요)').fill('신고 #9')
    await page.getByRole('button', { name: '저장' }).click()
    await expect(page.getByRole('status').filter({ hasText: '꾸러미를 고쳤어요.' })).toBeVisible()
    expect(server.fixes[0]).toMatchObject({
      kind: 'words',
      meaning: '피곤한, 지친 (고침)',
      example: null,
      hidden: false,
      note: '신고 #9',
    })
    await expect(page.getByRole('list', { name: '고친 항목' }).locator('.pack-fix-row')).toContainText(['tired'])
    await expect(page.getByRole('list', { name: '고친 항목' }).locator('.report-status')).toHaveText('고침')

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([])

    // 사용자 화면: 단어장에 tired를 쓰면 고친 뜻으로 채우기를 권한다
    await page.goto(`${AUTH_URL}#words`)
    await page.getByLabel('단어 / 표현').fill('tired')
    await expect(page.locator('.pack-hint')).toContainText('피곤한, 지친 (고침)')

    await page.goto(`${AUTH_URL}#admin`)
    await page.getByRole('button', { name: '꾸러미 고치기', exact: true }).click()
    await page.getByRole('button', { name: 'tired 고치기', exact: true }).click()
    await page.getByRole('button', { name: '원래대로 되돌리기' }).click()
    await expect(page.getByRole('status').filter({ hasText: '원래대로 되돌렸어요.' })).toBeVisible()
    expect(server.fixes).toHaveLength(0)
    await expect(page.getByText('아직 고친 항목이 없어요.')).toBeVisible()
  })

  test('일기에서 앱 안 AI 교정을 받는다: 처음엔 동의를 묻고, 결과를 나눠 보여 주고, 하루 한도를 알려 준다', async ({
    page,
  }) => {
    await fakeSession(page)
    await fakeReportServer(page)
    const prompts = []
    let left = 4
    await page.route('https://example.supabase.co/functions/v1/correct-journal', async (route) => {
      prompts.push(route.request().postDataJSON().prompt)
      if (left < 0) return route.fulfill({ status: 429, json: { error: 'limit', remaining: 0 } })
      const remaining = left
      left -= 1
      return route.fulfill({
        json: {
          remaining,
          feedback: [
            '## 고친 문장',
            'I miss you so much today.',
            '## 고칠 점',
            '- 원래: I miss you very much today → 고침: I miss you so much today | 이유: 말할 때는 so much가 더 자연스러워요.',
            '## 잘한 점',
            '마음을 솔직하게 전했어요.',
            '## 연습할 점',
            'so와 very의 느낌 차이를 익혀 보세요.',
          ].join('\n'),
        },
      })
    })

    await page.goto(`${AUTH_URL}#journal`)
    await page.getByLabel('우리말로 쓰기').fill('오늘 연인이 너무 보고 싶었다.')
    await page.getByLabel('영어로 옮겨 보기').fill('I miss you very much today.')
    await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()

    // 처음에는 어디로 보내지는지 알리고 동의를 받는다(보내기 전이라 요청이 없다)
    await expect(page.getByRole('heading', { name: '보내기 전에 알려 드릴게요' })).toBeVisible()
    await expect(page.getByText('Google Gemini', { exact: false }).first()).toBeVisible()
    expect(prompts).toHaveLength(0)
    await page.getByRole('button', { name: '알겠어요, 다듬어 주세요' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'AI 교정이 도착했어요.' })).toBeVisible()
    expect(prompts[0]).toContain('I miss you very much today.')
    expect(prompts[0]).toContain('오늘 연인이 너무 보고 싶었다.')
    await expect(page.locator('form .correction-panel')).toContainText('I miss you so much today.')
    await expect(page.locator('form .correction-panel')).toContainText('so much가 더 자연스러워요')
    await expect(page.getByText('오늘 4번 더 쓸 수 있어요.')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([])

    // 두 번째부터는 묻지 않고 바로 보낸다. 한도를 넘으면 알려 준다.
    left = -1
    await page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' }).click()
    await expect(page.getByRole('status').filter({ hasText: '오늘 AI 교정을 다 썼어요.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '보내기 전에 알려 드릴게요' })).toHaveCount(0)
  })

  test('친구·연인과 한 문장: 새로고침을 누르지 않아도 화면으로 돌아오거나 30초가 지나면 새 문장이 보인다', async ({
    page,
  }) => {
    await page.clock.install()
    await fakeSession(page)
    await fakeReportServer(page)
    const ME = '11111111-1111-4111-8111-111111111111'
    const FRIEND = '33333333-3333-4333-8333-333333333333'
    const day = new Date()
    const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const db = {
      couples: [{ id: 'c1', code: 'XYZ789', kind: 'friend' }],
      members: [
        { couple_id: 'c1', user_id: ME, nickname: '나', joined_at: '2026-11-01T00:00:00Z' },
        { couple_id: 'c1', user_id: FRIEND, nickname: 'Yuki', joined_at: '2026-11-01T00:00:00Z' },
      ],
      sentences: [],
    }
    await page.route('https://example.supabase.co/rest/v1/**', async (route) => {
      const url = route.request().url()
      if (url.includes('/couple_members')) return route.fulfill({ json: db.members })
      if (url.includes('/couples')) return route.fulfill({ json: db.couples })
      if (url.includes('/couple_reactions')) return route.fulfill({ json: [] })
      if (url.includes('/couple_sentences')) return route.fulfill({ json: db.sentences })
      return route.fallback()
    })

    await page.goto(`${AUTH_URL}#couple`)
    const feed = page.getByRole('region', { name: '오늘 받은 문장' })
    await expect(feed).toContainText('오늘은 아직 받은 문장이 없어요.')

    // 다른 앱에 갔다가 돌아오면 다시 불러온다
    db.sentences.push({
      id: 1,
      couple_id: 'c1',
      user_id: FRIEND,
      day: today,
      body: 'Lowkey tired today lol',
      lang: 'en',
    })
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(feed).toContainText('Lowkey tired today lol')

    // 화면을 켜 둔 채로 30초가 지나도 다시 불러온다
    db.sentences.push({ id: 2, couple_id: 'c1', user_id: FRIEND, day: today, body: 'You up?', lang: 'en' })
    await page.clock.fastForward(31_000)
    await expect(feed).toContainText('You up?')
  })

  test('친구·연인과 한 문장: 연인 초대를 만들고, 오늘 받은 문장을 모아 보고 한 번에 답하고, 친구를 더해 걸러 본다', async ({
    page,
  }) => {
    await fakeSession(page)
    await fakeReportServer(page)
    const ME = '11111111-1111-4111-8111-111111111111'
    const PARTNER = '22222222-2222-4222-8222-222222222222'
    const FRIEND = '33333333-3333-4333-8333-333333333333'
    const day = new Date()
    const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const db = { couples: [], members: [], sentences: [], reactions: [], created: [] }
    await page.route('https://example.supabase.co/rest/v1/**', async (route) => {
      const request = route.request()
      const url = request.url()
      if (url.includes('/rpc/create_couple')) {
        const body = request.postDataJSON()
        db.created.push(body)
        db.couples.push({ id: 'c1', code: 'ABC234', kind: body.pair_kind })
        db.members.push({ couple_id: 'c1', user_id: ME, nickname: body.nick, joined_at: '2026-11-01T00:00:00Z' })
        return route.fulfill({ json: 'ABC234' })
      }
      if (url.includes('/couple_members')) return route.fulfill({ json: db.members })
      if (url.includes('/couples')) return route.fulfill({ json: db.couples })
      if (url.includes('/couple_reactions')) {
        if (request.method() === 'POST') {
          const row = { ...request.postDataJSON(), user_id: ME }
          db.reactions = db.reactions.filter((item) => !(item.sentence_id === row.sentence_id && item.user_id === ME))
          db.reactions.push(row)
          return route.fulfill({ status: 201, json: [] })
        }
        if (request.method() === 'DELETE') {
          db.reactions = db.reactions.filter((item) => item.user_id !== ME)
          return route.fulfill({ status: 204, body: '' })
        }
        return route.fulfill({ json: db.reactions })
      }
      if (url.includes('/couple_sentences')) {
        if (request.method() === 'POST') {
          const row = { ...request.postDataJSON(), id: db.sentences.length + 100, user_id: ME }
          db.sentences = db.sentences.filter(
            (item) => !(item.user_id === ME && item.day === row.day && item.couple_id === row.couple_id),
          )
          db.sentences.push(row)
          return route.fulfill({ status: 201, json: [] })
        }
        return route.fulfill({ json: db.sentences })
      }
      return route.fallback()
    })

    // 상대가 아무도 없으면 바로 추가 화면이 나온다. 연인을 고르고 초대 번호를 만든다.
    await page.goto(`${AUTH_URL}#couple`)
    await expect(page.getByRole('heading', { name: '친구·연인과 한 문장' })).toBeVisible()
    await page.getByRole('button', { name: '초대 번호 만들기' }).click()
    expect(db.created[0].pair_kind).toBe('partner')
    await expect(page.getByRole('heading', { name: '기다리는 초대' })).toBeVisible()
    await expect(page.getByLabel('초대 번호', { exact: true })).toHaveText('ABC234')

    // 연인이 들어오고 오늘 문장을 보냈다: 오늘 받은 문장에 모이고, 동그라미에 점이 붙는다.
    db.members.push({ couple_id: 'c1', user_id: PARTNER, nickname: 'Sam', joined_at: '2026-11-01T00:00:00Z' })
    db.sentences.push({
      id: 1,
      couple_id: 'c1',
      user_id: PARTNER,
      day: today,
      body: 'I was thinking about you today.',
      lang: 'en',
    })
    await page.getByRole('button', { name: '새로 불러오기' }).click()
    const feed = page.getByRole('region', { name: '오늘 받은 문장' })
    await expect(feed).toContainText('I was thinking about you today.')
    await expect(feed).toContainText('Sam · 연인')
    await expect(page.getByRole('button', { name: 'Sam 연인 · 오늘 받은 문장이 있어요' })).toBeVisible()

    // 반응을 남기고(다시 누르면 지운다), 아직 안 보낸 상대에게 한 번에 답한다.
    const heart = feed.getByRole('button', { name: '좋아요', exact: true })
    await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    expect(db.reactions).toEqual([{ sentence_id: 1, kind: 'heart', user_id: ME }])
    await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('아직 안 보낸 상대: Sam')).toBeVisible()
    await page.getByLabel('오늘 보낼 한 문장').fill('I missed you too.')
    await page.getByRole('button', { name: '1명에게 보내기' }).click()
    await expect(page.getByRole('status').filter({ hasText: '1명에게 보냈어요.' })).toBeVisible()
    await expect(page.getByText('오늘은 모두에게 보냈어요.')).toBeVisible()

    // 친구를 더한다: 연인은 이미 있어서 친구만 고를 수 있다.
    await page.getByRole('button', { name: '추가', exact: true }).click()
    await expect(page.getByText('연인은 한 명만 맺을 수 있어요.')).toBeVisible()
    db.couples.push({ id: 'c2', code: 'XYZ789', kind: 'friend' })
    db.members.push(
      { couple_id: 'c2', user_id: ME, nickname: '나', joined_at: '2026-11-03T00:00:00Z' },
      { couple_id: 'c2', user_id: FRIEND, nickname: 'Yuki', joined_at: '2026-11-03T00:00:00Z' },
    )
    db.sentences.push({
      id: 2,
      couple_id: 'c2',
      user_id: FRIEND,
      day: today,
      body: 'Lowkey tired today lol',
      lang: 'en',
    })
    await page.getByRole('button', { name: '추가', exact: true }).click()
    await page.getByRole('button', { name: '새로 불러오기' }).click()
    await expect(feed).toContainText('Lowkey tired today lol')
    await page.getByRole('group', { name: '보여 줄 상대' }).getByRole('button', { name: '친구', exact: true }).click()
    await expect(feed).toContainText('Lowkey tired today lol')
    await expect(feed).not.toContainText('I was thinking about you today.')
    await page.getByRole('group', { name: '보여 줄 상대' }).getByRole('button', { name: '전체', exact: true }).click()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([])

    // 연인 동그라미를 누르면 그 사람과 주고받는 화면이 열리고, 연인의 반응을 본다.
    const mineId = db.sentences.find((item) => item.user_id === ME).id
    db.reactions.push({ sentence_id: mineId, user_id: PARTNER, kind: 'funny' })
    await page.getByRole('button', { name: /^Sam 연인/ }).click()
    await page.getByRole('button', { name: '새로 불러오기' }).click()
    await expect(page.getByText('Sam님과 함께 쓰고 있어요.')).toBeVisible()
    await expect(page.getByText('둘 다 보낸 날 1일 연속')).toBeVisible()
    await expect(page.getByText('Sam님이 "웃겨요"로 반응했어요.')).toBeVisible()

    await page.getByRole('button', { name: '표현 모음에 담기' }).first().click()
    await expect(page.getByRole('status').filter({ hasText: '표현 모음에 담았어요.' })).toBeVisible()
    await page.goto(`${AUTH_URL}#expressions`)
    await expect(page.getByText('I was thinking about you today.')).toBeVisible()
  })

  test('프로필에서 이름을 바꾸면 계정에 저장되고 화면 곳곳에 바로 보인다', async ({ page }) => {
    await fakeSession(page)
    await fakeReportServer(page)
    const updates = []
    await page.route('https://example.supabase.co/auth/v1/user', async (route) => {
      if (route.request().method() === 'PUT') {
        updates.push(route.request().postDataJSON())
        return route.fulfill({
          json: {
            id: '11111111-1111-4111-8111-111111111111',
            aud: 'authenticated',
            email: 'learner@example.com',
            user_metadata: { nickname: 'Mina' },
          },
        })
      }
      return route.fallback()
    })
    await page.goto(`${AUTH_URL}#profile`)
    await expect(page.getByRole('heading', { name: 'Tester', level: 2 })).toBeVisible()
    await expect(page.getByRole('main').getByText('learner@example.com')).toBeVisible()
    await page.getByRole('button', { name: '이름 바꾸기' }).click()
    await page.getByLabel('닉네임').fill('Mina')
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '이름을 바꿨어요.' })).toBeVisible()
    expect(updates[0]).toMatchObject({ data: { nickname: 'Mina' } })
    await expect(page.getByRole('heading', { name: 'Mina', level: 2 })).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([])
  })

  test('설정: 알림을 허용하고 연인 새 문장 알림을 켜면 서버에 알리고, 시험 알림을 보낸다', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['notifications'])
    await fakeSession(page)
    await fakeReportServer(page)
    const calls = []
    await page.route('https://example.supabase.co/rest/v1/rpc/set_couple_notify', async (route) => {
      calls.push(route.request().postDataJSON())
      return route.fulfill({ status: 204, body: '' })
    })
    await page.goto(`${AUTH_URL}#settings`)
    await expect(page.getByRole('heading', { name: '설정', level: 1 })).toBeVisible()
    await expect(page.getByText('알림 허용: 켜짐')).toBeVisible()
    await page.getByRole('switch', { name: '연인의 새 문장이 오면 알려 주기' }).click()
    await expect(page.getByRole('switch', { name: '연인의 새 문장이 오면 알려 주기' })).toBeChecked()
    expect(calls[0]).toEqual({ enabled: true, msg_lang: 'ko' })
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('reminders')))).toMatchObject({ couple: true })

    await page.getByRole('button', { name: '시험 알림 보내기' }).click()
    await expect(page.getByRole('status').filter({ hasText: '시험 알림을 보냈어요' })).toBeVisible()

    // 하루 목표와 화면 테마, 로그아웃까지 한 화면에 있다
    await expect(page.getByRole('group', { name: '배우는 언어' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '어둡게' })).toBeVisible()
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((v) => `${v.id}: ${v.nodes[0].html}`)).toEqual([])
  })

  test('로그인하지 않으면 AI 교정 대신 로그인을 권하고, 다른 AI로 복사하는 길은 없다', async ({ page }) => {
    await page.goto(AUTH_URL)
    await page.getByRole('button', { name: '로그인 없이 먼저 써 보기' }).click()
    await page.goto(`${AUTH_URL}#journal`)
    await expect(page.getByText('AI 교정은 로그인하면 바로 쓸 수 있어요.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'AI에게 자연스럽게 다듬어 달라고 하기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /복사|붙여 넣기/ })).toHaveCount(0)
  })

  test('관리자가 아니면 관리자 페이지 내용을 볼 수 없다', async ({ page }) => {
    await fakeSession(page)
    await fakeReportServer(page, { admin: false })
    await page.goto(`${AUTH_URL}#admin`)
    await expect(page.getByText('관리자 계정만 볼 수 있는 페이지예요.')).toBeVisible()
    await expect(page.locator('.admin-item')).toHaveCount(0)
  })

  test('처음 온 사람은 앱 소개를 보고 로그인 없이 써 볼 수 있고, 나중에 로그인하러 갈 수 있다', async ({ page }) => {
    await page.goto(AUTH_URL)
    await expect(page.getByRole('heading', { name: '외국인 친구·연인과 나눈 말이 내 단어장이 되는 곳' })).toBeVisible()
    await page.getByRole('button', { name: '로그인 없이 먼저 써 보기' }).click()
    await expect(page.locator('main h1')).toBeVisible()
    await page.goto(`${AUTH_URL}#words`)
    await page.getByLabel('단어 / 표현').fill('guest')
    await page.getByLabel('뜻', { exact: true }).fill('손님')
    await page.getByRole('button', { name: '저장하기' }).click()
    await expect(page.locator('.record-row')).toContainText('guest')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')).length)).toBe(1)

    await page.goto(`${AUTH_URL}#profile`)
    await page.getByRole('button', { name: '로그인하고 기록 지키기' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  })

  test('접근성, 입력 오류, 비밀번호 보기', async ({ page }, info) => {
    await page.goto(AUTH_URL)
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()

    await page.getByRole('button', { name: '로그인하기' }).click()
    await expect(page.getByText('이메일 주소를 확인해 주세요.')).toBeVisible()
    await expect(page.getByText('비밀번호는 6자 이상이어야 해요.')).toBeVisible()

    const password = page.getByLabel('비밀번호', { exact: true })
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: '비밀번호 보기' }).click()
    await expect(password).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page.getByLabel('닉네임')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(violations.map((item) => `${item.id}: ${item.nodes[0].html}`)).toEqual([])
    await page.screenshot({ path: `e2e-shots/${info.project.name}-login.png` })
  })

  test('구글과 카카오 버튼은 Supabase 로그인 주소로 보낸다', async ({ page }) => {
    for (const [name, provider] of [
      ['Google로 계속하기', 'google'],
      ['카카오 로그인', 'kakao'],
    ]) {
      await page.route('https://example.supabase.co/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<p>provider</p>' }),
      )
      await page.goto(AUTH_URL)
      await page.getByRole('button', { name }).click()
      await page.waitForURL(/example\.supabase\.co\/auth\/v1\/authorize/)
      const url = new URL(page.url())
      expect(url.searchParams.get('provider')).toBe(provider)
      expect(url.searchParams.get('redirect_to')).toBe('http://localhost:4174')
    }
  })

  test('소셜 로그인을 취소하고 돌아오면 이유를 보여 준다', async ({ page }) => {
    await page.goto(`${AUTH_URL}?error=access_denied&error_description=User+cancelled+login`)
    await expect(page.getByRole('status').filter({ hasText: 'User cancelled login' })).toBeVisible()
    expect(new URL(page.url()).search).toBe('')
  })

  test('인터넷이 끊기거나 서버가 고장 나면 알아듣기 쉬운 말로 알려 준다', async ({ page, context }) => {
    await page.goto(AUTH_URL)
    await page.getByLabel('이메일').fill('learner@example.com')
    await page.getByLabel('비밀번호', { exact: true }).fill('secret123')

    await context.setOffline(true)
    await page.getByRole('button', { name: '로그인하기' }).click()
    await expect(page.getByText('인터넷이 끊겨 있어요.')).toBeVisible()
    await context.setOffline(false)

    await page.route('https://example.supabase.co/**', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"upstream down"}' }),
    )
    await page.getByRole('button', { name: '로그인하기' }).click()
    await expect(page.getByText('서버가 잠시 쉬는 중이에요.', { exact: false })).toBeVisible()
  })

  test('연결이 끊겨도 저장하고, 연결되면 서버에 올린다', async ({ page, context }) => {
    // 올린 행을 기억했다가 다시 불러올 때 돌려주는 가짜 서버
    const posted = []
    await page.route('https://example.supabase.co/rest/v1/**', async (route) => {
      const request = route.request()
      if (request.method() === 'GET') return route.fulfill({ json: posted.flat() })
      if (request.method() === 'POST') posted.push(request.postDataJSON())
      return route.fulfill({ status: 201, json: [] })
    })
    await fakeSession(page)
    await page.goto(`${AUTH_URL}#words`)
    await expect(page.getByRole('heading', { name: '단어장', level: 1 })).toBeVisible()

    await context.setOffline(true)
    await page.getByLabel('단어 / 표현').fill('offline word')
    await page.getByRole('textbox', { name: '뜻', exact: true }).fill('연결 없이 저장')
    await page.getByRole('button', { name: '저장하기' }).click()
    await expect(page.getByRole('status').filter({ hasText: '이 기기에 저장했어요' })).toBeVisible()
    await expect(page.locator('.offline-banner')).toContainText('올리지 못한 변경 1개')
    await expect(page.locator('.record-row')).toContainText('offline word')
    expect(posted).toHaveLength(0)

    await context.setOffline(false)
    await expect.poll(() => posted.length).toBe(1)
    expect(JSON.stringify(posted[0])).toContain('offline word')
    await expect(page.locator('.offline-banner')).toHaveCount(0)
    expect(
      await page.evaluate(() => localStorage.getItem('pendingOps:11111111-1111-4111-8111-111111111111')),
    ).toBeNull()

    // 서버에 닿지 않을 때 앱을 다시 열면, 이 기기에 남긴 기록을 보여 준다.
    await page.unroute('https://example.supabase.co/rest/v1/**')
    await page.route('https://example.supabase.co/rest/v1/**', (route) => route.abort('internetdisconnected'))
    await page.reload()
    await expect(page.locator('.record-row')).toContainText('offline word')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('로그인 없이 개인정보 처리방침을 볼 수 있다', async ({ page }) => {
    await page.goto(AUTH_URL)
    await page.getByRole('link', { name: '개인정보 처리방침' }).click()
    await expect(page.getByRole('heading', { name: '외부 전송' })).toBeVisible()
  })
})
