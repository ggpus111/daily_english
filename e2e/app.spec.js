import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const AUTH_URL = 'http://localhost:4174/'
const PAGES = ['home', 'words', 'expressions', 'chats', 'journal', 'profile', 'privacy']

const seed = {
  savedWords: [
    { id: 'w1', createdAt: '2026-11-06T01:00:00Z', text: 'thoughtful', meaning: '사려 깊은, 배려하는', example: 'It was a thoughtful gift.' },
    { id: 'w2', createdAt: '2026-11-06T00:00:00Z', text: 'hang out', meaning: '어울려 놀다', example: '' },
  ],
  savedExpressions: [
    { id: 'e1', createdAt: '2026-11-06T00:00:00Z', text: 'Me too!', meaning: '나도!', example: '' },
  ],
  savedChats: [
    { id: 'c1', createdAt: '2026-11-06T00:00:00Z', situation: '친구가 안부를 물었을 때', message: 'How have you been?', meaning: '잘 지냈어?', category: 'daily', note: '자주 쓰는 인사' },
  ],
  savedJournals: [
    { id: 'j1', createdAt: '2026-11-05T00:00:00Z', native: '공원을 걸었다.', translation: 'I walked at the park.', memo: '', aiFeedback: 'in the park가 자연스러워요.' },
  ],
}

async function seedRecords(page) {
  await page.goto('/')
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
  }, seed)
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

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflow).toBe(false)
      expect(errors).toEqual([])
      await page.screenshot({
        path: `e2e-shots/${info.project.name}-${name}.png`,
        fullPage: true,
      })
    })
  }

  test('320px 폭에서도 가로로 넘치지 않는다', async ({ page }) => {
    await seedRecords(page)
    await page.setViewportSize({ width: 320, height: 640 })
    for (const name of PAGES) {
      await open(page, name)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflow, name).toBe(false)
    }
  })
})

test('단어 추가, 입력 오류, 수정, 삭제, 새로고침 유지', async ({ page }) => {
  await open(page, 'words')

  await page.getByRole('button', { name: '저장하기' }).click()
  await expect(page.getByLabel('단어 / 표현')).toBeFocused()
  await expect(page.getByLabel('단어 / 표현')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('꼭 입력해 주세요.').first()).toBeVisible()

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

  const answers = { thoughtful: '배려하는', 'hang out': '어울려놀다' }
  for (let i = 0; i < 2; i += 1) {
    const question = await page.locator('.quiz-question').textContent()
    await page.getByLabel('정답을 입력해 보세요').fill(answers[question])
    await page.keyboard.press('Enter')
    await expect(page.getByText('정답이에요!')).toBeVisible()
    await page.keyboard.press('Enter')
  }

  await expect(page.getByRole('heading', { name: '퀴즈 완료! 2 / 2개 정답' })).toBeFocused()

  // 맞힌 단어는 다음 복습 날짜가 뒤로 밀려 오늘의 복습에서 빠진다.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')))
  expect(saved.every((word) => word.box === 1 && Date.parse(word.dueAt) > Date.now())).toBe(true)
  await page.getByRole('button', { name: '오늘의 복습' }).click()
  await expect(page.getByRole('heading', { name: /오늘 복습할 게 없어요/ })).toBeVisible()

  await open(page, 'home')
  // 단어는 모두 맞혀서 빠지고, 아직 복습하지 않은 표현 1개만 남는다.
  await expect(page.locator('.review-count')).toHaveText('1개')
  await expect(page.getByText('단어 0개 · 표현 1개')).toBeVisible()
  await expect(page.locator('.count').first()).toContainText('일 연속')
})

test('틀린 단어는 오늘 다시 묻는다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'home')
  await expect(page.locator('.review-count')).toHaveText('3개')
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByLabel('정답을 입력해 보세요').fill('전혀 다른 답')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/아쉬워요/)).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('savedWords')))
  const wrong = saved.find((word) => word.box === 0)
  expect(Date.parse(wrong.dueAt)).toBeLessThanOrEqual(Date.now())
})

test('AI 교정 요청을 복사하고 받은 교정을 저장한다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, 'journal')

  await page.getByRole('button', { name: 'AI 교정 요청 복사' }).click()
  await expect(page.getByRole('status').filter({ hasText: '모두 작성해' })).toBeVisible()

  await page.getByLabel('모국어로 작성하기').fill('어제 공원을 걸었다.')
  await page.getByLabel('영어로 직접 번역하기').fill('I walked at the park yesterday.')
  await page.getByRole('button', { name: 'AI 교정 요청 복사' }).click()
  await expect(page.getByRole('status').filter({ hasText: '복사했어요' })).toBeVisible()

  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('학습 언어: 영어')
  expect(copied).toContain('설명 언어: 한국어')
  expect(copied).toContain('어제 공원을 걸었다.')
  expect(copied).toContain('I walked at the park yesterday.')

  await page.getByLabel('AI 교정 결과 (선택)').fill('at the park 대신 in the park가 자연스러워요.')
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await expect(page.getByLabel('모국어로 작성하기')).toHaveValue('')

  await page.reload()
  await page.getByRole('button', { name: '자세히 보기' }).click()
  await expect(page.locator('.journal-entry .correction-panel')).toContainText('in the park')
})

test('자동 복사가 막히면 직접 복사할 수 있게 보여 준다', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'))
  })
  await open(page, 'journal')
  await page.getByLabel('모국어로 작성하기').fill('일기')
  await page.getByLabel('영어로 직접 번역하기').fill('diary')
  await page.getByRole('button', { name: 'AI 교정 요청 복사' }).click()
  await expect(page.getByLabel('자동 복사가 안 됐어요', { exact: false })).toHaveValue(/diary/)
})

test('AI 채팅 링크는 새 탭에서 안전하게 열린다', async ({ page }) => {
  await open(page, 'journal')
  const link = page.getByRole('link', { name: 'Claude 열기 (새 탭)' })
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('원본 앱 형식으로 남은 기록도 읽는다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('savedWords', JSON.stringify([{ id: 1731400000000, word: 'legacy word', meaning: '옛 단어' }]))
    localStorage.setItem('savedJournals', JSON.stringify([{ id: 1731400000001, nativeText: '옛 일기', translation: 'old', note: '' }]))
  })
  await open(page, 'words')
  await expect(page.locator('.record-row')).toContainText('legacy word')
  await open(page, 'journal')
  await expect(page.locator('.journal-entry')).toContainText('옛 일기')
})

test('작성 중인 일기는 새로고침해도 남는다', async ({ page }) => {
  await open(page, 'journal')
  await page.getByLabel('모국어로 작성하기').fill('아직 다 못 쓴 일기')
  await page.reload()
  await expect(page.getByLabel('모국어로 작성하기')).toHaveValue('아직 다 못 쓴 일기')
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

  await page.getByRole('navigation').getByRole('button', { name: '단어장' }).click()
  await expect(page.locator('main')).toBeFocused()
  await expect(page).toHaveTitle('단어장 · Daily English')
})

test('언어를 바꾸면 화면과 html lang이 바뀐다', async ({ page }) => {
  await open(page, 'profile')
  await page.getByLabel('설명 언어').selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})

test('내보내기와 전체 삭제', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'profile')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '내 기록 내려받기' }).click()
  expect((await download).suggestedFilename()).toMatch(/^daily-english-.*\.json$/)

  await page.getByRole('button', { name: '모든 기록 삭제' }).click()
  await page.getByRole('button', { name: /정말 삭제할까요/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '모든 기록을 삭제했어요' })).toBeVisible()
  const words = await page.evaluate(() => localStorage.getItem('savedWords'))
  expect(words).toBe('[]')
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

test.describe('로그인 화면', () => {
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
    for (const [name, provider] of [['Google로 계속하기', 'google'], ['카카오 로그인', 'kakao']]) {
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

  test('로그인 없이 개인정보 처리방침을 볼 수 있다', async ({ page }) => {
    await page.goto(AUTH_URL)
    await page.getByRole('link', { name: '개인정보 처리방침' }).click()
    await expect(page.getByRole('heading', { name: '외부 전송' })).toBeVisible()
  })
})
