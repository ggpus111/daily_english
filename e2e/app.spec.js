import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const AUTH_URL = 'http://localhost:4174/'
const PAGES = ['home', 'words', 'expressions', 'chats', 'journal', 'profile', 'privacy', 'pro', 'packs', 'packs-words']

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
    await open(page, 'profile')
    await page.getByLabel('화면 테마').selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(await background()).toBe('rgb(58, 46, 41)')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByLabel('화면 테마').selectOption('system')
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  })

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

// Windows 클립보드는 줄바꿈을 \r\n으로 바꿔 돌려주므로 \n으로 맞춘다.
const readClipboard = async (page) =>
  (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')

test('AI 교정 요청을 복사하고 받은 교정을 저장한다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, 'journal')

  await page.getByRole('button', { name: 'AI 교정 요청 복사' }).click()
  await expect(page.getByRole('status').filter({ hasText: '모두 작성해' })).toBeVisible()

  await page.getByLabel('모국어로 작성하기').fill('어제 공원을 걸었다.')
  await page.getByLabel('영어로 직접 번역하기').fill('I walked at the park yesterday.')
  await page.getByRole('button', { name: 'AI 교정 요청 복사' }).click()
  await expect(page.getByRole('status').filter({ hasText: '복사했어요' })).toBeVisible()

  const copied = await readClipboard(page)
  expect(copied).toContain('다정한 영어 튜터')
  expect(copied).toContain('## 고친 문장\n## 고칠 점\n## 잘한 점\n## 연습할 점')
  expect(copied).toContain('[일기]\n어제 공원을 걸었다.')
  expect(copied).toContain('[내 번역]\nI walked at the park yesterday.')

  // AI가 정해진 형식으로 답하면 제목별로 나눠 보여 준다.
  await page.getByLabel('AI 교정 결과 (선택)').fill(
    [
      '## 고친 문장',
      'I walked in the park yesterday.',
      '## 고칠 점',
      '- 원래: at the park → 고침: in the park | 이유: 공원 안을 걸었으니 in이 자연스러워요.',
      '## 잘한 점',
      '과거형을 잘 썼어요.',
      '## 연습할 점',
      '장소 전치사 in과 at을 구분해 보세요.',
    ].join('\n'),
  )
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await expect(page.getByLabel('모국어로 작성하기')).toHaveValue('')

  await page.reload()
  await page.getByRole('button', { name: '자세히 보기' }).click()
  const panel = page.locator('.journal-entry .correction-panel')
  await expect(panel.getByRole('heading', { name: '고친 문장' })).toBeVisible()
  await expect(panel.locator('ins')).toHaveText('in the park')
  await expect(panel.locator('del')).toHaveText('at the park')

  // 다음 요청에는 지난번 연습할 점이 함께 들어간다.
  await page.getByLabel('모국어로 작성하기').fill('오늘 학교에 갔다.')
  await page.getByLabel('영어로 직접 번역하기').fill('I went to school today.')
  await page.getByRole('button', { name: 'AI 교정 요청 복사' }).click()
  await expect(page.getByRole('status').filter({ hasText: '복사했어요' })).toBeVisible()
  const next = await readClipboard(page)
  expect(next).toContain('[참고: 지난 교정에서 연습하기로 한 점]\n- 장소 전치사 in과 at을 구분해 보세요.')
})

test('일기: 오늘 기분을 영어로 고르고, 교정의 고칠 점을 표현 모음에 담아 복습한다', async ({ page }) => {
  await open(page, 'journal')

  // 기분을 고르면 그 낱말을 쓴 예문이 보이고, 단어장에 담을 수 있다.
  const tired = page.locator('.mood-chips').getByRole('button', { name: /^tired/ })
  await tired.click()
  await expect(tired).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('I was so tired today.')).toBeVisible()
  await page.getByRole('button', { name: 'tired 단어장에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '"tired"를 단어장에 담았어요.' })).toBeVisible()

  await page.getByLabel('모국어로 작성하기').fill('오늘 친구랑 카페에 갔다.')
  await page.getByLabel('영어로 직접 번역하기').fill('Today I go to cafe with friend.')
  await page.getByLabel('AI 교정 결과 (선택)').fill(
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
  )
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await expect(page.locator('.journal-entry .mood-tag')).toHaveText('tired · 피곤한')

  await page.getByRole('button', { name: '자세히 보기' }).click()
  await page.getByRole('button', { name: 'with my friend 내 표현 모음에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '"with my friend"를 내 표현 모음에 담았어요.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'with my friend 이미 담음' })).toBeDisabled()

  // 표현 모음에서는 원래 쓴 말과 이유를 보고 고친 말을 떠올린다.
  await open(page, 'expressions')
  await expect(page.locator('.record-row')).toContainText('원래 쓴 말: with friend')
  await page.getByRole('button', { name: '표현 퀴즈' }).click()
  await expect(page.locator('.quiz-question')).toHaveText('원래 쓴 말: with friend · my를 붙이면 자연스러워요.')
  await page.getByLabel('정답을 입력해 보세요').fill('with my friend')
  await page.keyboard.press('Enter')
  await expect(page.getByText('정답이에요!')).toBeVisible()
})

test('일기에 쓴 내 표현과 오늘의 표현을 찾고, 홈의 도장과 이번 주 돌아보기에 모은다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'journal')

  // 오늘의 표현은 날마다 바뀌므로 화면에 보이는 표현을 읽어 그대로 써 본다.
  const mission = page.locator('.today-mission')
  await expect(mission).toContainText('오늘의 표현을 써 보세요:')
  const phrase = (await mission.locator('b').textContent()).replace(/[.!?]+$/, '')

  await page.locator('.mood-chips').getByRole('button', { name: /^happy/ }).click()
  await page.getByLabel('모국어로 작성하기').fill('친구들이랑 놀았다.')
  await page.getByLabel('영어로 직접 번역하기').fill(`I hang out with my friends. ${phrase}.`)
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

test('빈칸 채우기: 예문이 있는 단어만 내고, 예문 속 형태로 답한다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'words')
  await page.getByRole('button', { name: '단어 퀴즈' }).click()
  await page.getByRole('button', { name: '빈칸 채우기' }).click()

  // 예문이 있는 thoughtful만 나오고, 예문이 없는 hang out은 빠진다.
  await expect(page.locator('.quiz-question')).toHaveText('It was a ____(빈칸) gift.')
  await expect(page.getByText('뜻: 사려 깊은, 배려하는')).toBeVisible()
  await page.getByLabel('정답을 입력해 보세요').fill('thoughtful')
  await page.keyboard.press('Enter')
  await expect(page.getByText('정답이에요!')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '퀴즈 완료! 1 / 1개 정답' })).toBeFocused()
})

test('형식 없이 붙여 넣은 교정도 그대로 보여 준다', async ({ page }) => {
  await open(page, 'journal')
  await page.getByLabel('모국어로 작성하기').fill('어제 공원을 걸었다.')
  await page.getByLabel('AI 교정 결과 (선택)').fill('at the park 대신 in the park가 자연스러워요.')
  await page.getByRole('button', { name: '일기 저장하기' }).click()
  await page.getByRole('button', { name: '자세히 보기' }).click()
  await expect(page.locator('.journal-entry .feedback-raw')).toHaveText('at the park 대신 in the park가 자연스러워요.')
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

test('내려받은 백업 파일로 지운 기록을 되살린다', async ({ page }) => {
  await seedRecords(page)
  await open(page, 'profile')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '내 기록 내려받기' }).click()
  const backupPath = await (await download).path()

  await page.getByRole('button', { name: '모든 기록 삭제' }).click()
  await page.getByRole('button', { name: /정말 삭제할까요/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '모든 기록을 삭제했어요' })).toBeVisible()

  const fileInput = page.getByLabel('파일에서 가져오기')
  await fileInput.setInputFiles(backupPath)
  const plan = page.getByRole('region', { name: '가져올 기록' })
  await expect(plan).toContainText('단어 2개 · 표현 1개 · 대화 1개 · 일기 1개를 더해요.')
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
  await open(page, 'profile')
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
  await page.locator('.expression-card').filter({ hasText: 'hang out' }).getByRole('button', { name: 'hang out 내 표현 모음에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '"hang out"를 내 표현 모음에 담았어요.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'hang out 이미 담음' })).toBeDisabled()
  await expect(page.locator('.pack-panel .count')).toHaveText('1 / 40 담음')
  await expect(page.getByText('Tatoeba')).toBeVisible()

  await open(page, 'expressions')
  await expect(page.locator('.record-row')).toContainText('hang out')
  await expect(page.locator('.record-row')).toContainText('어울려 놀다')
  await expect(page.getByText('오늘 복습할 것 1개')).toBeVisible()
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
  const card = page.locator('.expression-card').filter({ has: page.getByRole('heading', { name: 'school', exact: true }) })
  await expect(card.getByRole('link', { name: /Tatoeba #\d+ 예문 원문 보기/ })).toBeVisible()
  const ownCard = page.locator('.expression-card').filter({ has: page.getByRole('heading', { name: 'money', exact: true }) })
  await expect(ownCard.getByRole('link')).toHaveCount(0)
  await card.getByRole('button', { name: 'school 단어장에 담기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '"school"를 단어장에 담았어요.' })).toBeVisible()
  await expect(page.locator('.pack-panel .count')).toHaveText('1 / 300 담음')

  // 중급으로 바꾸면 범위가 처음으로 돌아간다.
  await page.getByRole('button', { name: '중급' }).click()
  await expect(page.getByRole('button', { name: '1–50' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '표현 400개' }).click()
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

  test('인터넷이 끊기거나 서버가 고장 나면 알아듣기 쉬운 말로 알려 준다', async ({ page, context }) => {
    await page.goto(AUTH_URL)
    await page.getByLabel('이메일').fill('learner@example.com')
    await page.getByLabel('비밀번호', { exact: true }).fill('secret123')

    await context.setOffline(true)
    await page.getByRole('button', { name: '로그인하기' }).click()
    await expect(page.getByText('인터넷에 연결되어 있지 않아요.')).toBeVisible()
    await context.setOffline(false)

    await page.route('https://example.supabase.co/**', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"upstream down"}' }),
    )
    await page.getByRole('button', { name: '로그인하기' }).click()
    await expect(page.getByText('서버에 잠시 문제가 있어요.', { exact: false })).toBeVisible()
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
    await page.route('https://example.supabase.co/auth/v1/**', (route) => route.fulfill({ json: {} }))
    // 테스트용 가짜 로그인 세션. 값은 Supabase 클라이언트가 브라우저 저장소에서 읽는 형식이다.
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
    expect(await page.evaluate(() => localStorage.getItem('pendingOps:11111111-1111-4111-8111-111111111111'))).toBeNull()

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
