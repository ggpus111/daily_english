// 안드로이드 앱 회귀 테스트.
// 에뮬레이터(또는 연결한 기기)에 앱을 설치하고, 앱 안 웹뷰에 크롬 개발자 도구 프로토콜(CDP)로 붙어
// 사용자 흐름을 실제로 눌러 본다. Appium·Maestro를 따로 설치하지 않고 이미 쓰는 Playwright와 adb로 같은 일을 한다.
// 끝나면 앱이 죽었는지(크래시 로그)도 확인한다.
//
// 실행: npm run test:android                 앱을 새로 빌드해서 시험
//       npm run test:android -- --no-build   이미 만든 APK로 시험
//       npm run test:android -- --avd Pixel_10_Pro_XL
// 결과: test-results/android/ 에 화면(png)과 요약(summary.json)

import { execFileSync, execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

const APP_ID = 'com.dailyenglish.app'
const PORT = 9333
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = join(ROOT, 'test-results', 'android')
const isWindows = process.platform === 'win32'
const SDK = process.env.ANDROID_HOME ?? (isWindows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(process.env.HOME ?? '', 'Android', 'Sdk'))
const ADB = join(SDK, 'platform-tools', isWindows ? 'adb.exe' : 'adb')
const EMULATOR = join(SDK, 'emulator', isWindows ? 'emulator.exe' : 'emulator')
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const args = process.argv.slice(2)
const avdArg = args.includes('--avd') ? args[args.indexOf('--avd') + 1] : null

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const adb = (...params) => execFileSync(ADB, params, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
// pidof처럼 "없음"을 실패 코드로 알려 주는 명령은 빈 문자열로 받는다.
const adbQuiet = (...params) => {
  try {
    return adb(...params)
  } catch {
    return ''
  }
}

function build() {
  console.log('▶ 앱 빌드')
  execSync('npm run android:sync', { cwd: ROOT, stdio: 'inherit' })
  const env = { ...process.env, ANDROID_HOME: SDK }
  // Capacitor 8은 JDK 21이 필요하다. 다른 JAVA_HOME(예: JDK 17)이 잡혀 있어도 Android Studio에 든 JDK를 먼저 쓴다.
  const studioJdk = 'C:\\Program Files\\Android\\Android Studio\\jbr'
  if (isWindows && existsSync(studioJdk)) env.JAVA_HOME = studioJdk
  // 현재 폴더의 실행 파일을 찾지 않는 셸 설정도 있어서 gradlew를 전체 경로로 부른다.
  const gradlew = join(ROOT, 'android', isWindows ? 'gradlew.bat' : 'gradlew')
  execSync(`"${gradlew}" assembleDebug -q`, { cwd: join(ROOT, 'android'), stdio: 'inherit', env })
}

// 화면(접근성 트리)에서 글자를 찾아 그 가운데를 누른다. 디버거 없이 실제 사용자처럼 조작할 때 쓴다.
// 화면이 바뀌는 중에는 접근성 트리를 못 읽기도 해서 몇 번 다시 시도한다.
async function tapText(text, tries = 5) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const xml = adbQuiet('exec-out', 'uiautomator', 'dump', '/dev/tty')
    const node = xml.split('<node').find((part) => part.includes(`text="${text}"`) || part.includes(`content-desc="${text}"`))
    const match = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (match) {
      const [, left, top, right, bottom] = match.map(Number)
      adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)))
      return
    }
    await wait(1000)
  }
  throw new Error(`화면에서 "${text}"를 찾지 못했어요`)
}

async function ensureDevice() {
  if (adb('devices').split('\n').slice(1).some((line) => line.trim().endsWith('device'))) return
  const avd = avdArg ?? execFileSync(EMULATOR, ['-list-avds'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  if (!avd) throw new Error('연결된 기기도, 만들어 둔 에뮬레이터(AVD)도 없어요.')
  console.log(`▶ 에뮬레이터 켜기: ${avd}`)
  spawn(EMULATOR, ['-avd', avd, '-memory', '3072', '-no-boot-anim'], { detached: true, stdio: 'ignore' }).unref()
  adb('wait-for-device')
  for (let i = 0; i < 90 && adb('shell', 'getprop', 'sys.boot_completed') !== '1'; i += 1) await wait(2000)
}

async function launch() {
  console.log('▶ 설치하고 실행')
  adb('install', '-r', APK)
  adb('logcat', '-c')
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
  adb('shell', 'am', 'force-stop', APP_ID)
  adb('shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`)
  for (let i = 0; i < 30; i += 1) {
    await wait(1000)
    const pid = adbQuiet('shell', 'pidof', APP_ID)
    if (pid && adb('shell', 'cat', '/proc/net/unix').includes(`webview_devtools_remote_${pid}`)) {
      adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`)
      return
    }
  }
  throw new Error('앱 웹뷰의 디버깅 연결을 찾지 못했어요(디버그 빌드인지 확인).')
}

// ── 시나리오: 사용자가 실제로 하는 일 ─────────────────────────────
const scenarios = [
  [
    '첫 실행 안내를 건너뛰면 홈이 보인다',
    async (page) => {
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      await expect(page.locator('.onboarding')).toBeVisible({ timeout: 15_000 })
      await page.getByRole('button', { name: '나중에 할게요' }).click()
      await expect(page.locator('.review-panel')).toBeVisible()
    },
  ],
  [
    '단어를 저장하고 목록에서 본다',
    async (page) => {
      await page.evaluate(() => (location.hash = 'words'))
      await page.getByLabel('단어 / 표현').fill('tired')
      await expect(page.getByRole('button', { name: /꾸러미 뜻 채우기/ })).toBeVisible()
      await page.getByRole('button', { name: /꾸러미 뜻 채우기/ }).click()
      await expect(page.getByLabel('뜻', { exact: true })).not.toHaveValue('')
      await page.getByRole('button', { name: '저장하기' }).click()
      await expect(page.locator('.record-row').first()).toContainText('tired')
    },
  ],
  [
    '복습: 카드를 뒤집고 알았어요를 누른다',
    async (page) => {
      await page.getByRole('button', { name: '단어 퀴즈' }).click()
      await page.getByRole('button', { name: '뜻 보기' }).click()
      await page.getByRole('button', { name: '알았어요' }).click()
      await expect(page.getByRole('heading', { name: /퀴즈 완료/ })).toBeVisible()
    },
  ],
  [
    '일기: 기분을 고르고 저장한다',
    async (page) => {
      await page.evaluate(() => (location.hash = 'journal'))
      await page.locator('.mood-chips button', { hasText: 'tired' }).click()
      await page.getByLabel('모국어로 작성하기').fill('오늘은 피곤했다.')
      await page.getByLabel('영어로 직접 번역하기').fill('I was so tired today.')
      await expect(page.locator('.usage-box .usage-line')).toContainText('tired')
      await page.getByRole('button', { name: '일기 저장하기' }).click()
      await expect(page.locator('.journal-entry .mood-tag').first()).toContainText('tired')
    },
  ],
  [
    '이번 주 돌아보기를 공유 창으로 보낸다',
    async (page) => {
      await page.evaluate(() => (location.hash = 'home'))
      await page.locator('.recap-save').click()
      let focus = ''
      for (let i = 0; i < 10 && !/chooser|intentresolver|resolver/i.test(focus); i += 1) {
        await wait(700)
        focus = adb('shell', 'dumpsys', 'window').split('\n').find((line) => line.includes('mCurrentFocus')) ?? ''
      }
      expect(focus).toMatch(/chooser|intentresolver|resolver/i)
      adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      await wait(800)
    },
  ],
  [
    '휴대폰 뒤로 가기는 앞 화면으로 돌아간다',
    async (page) => {
      for (const hash of ['home', 'words', 'journal']) {
        await page.evaluate((value) => (location.hash = value), hash)
        await wait(400)
      }
      adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
      await wait(1000)
      expect(await page.evaluate(() => location.hash)).toBe('#words')
    },
  ],
  [
    '쓰던 일기는 앱이 꺼졌다 켜져도 남는다',
    async (page, { detach, reconnect }) => {
      await page.evaluate(() => (location.hash = 'journal'))
      await wait(800)
      // 디버거(CDP)를 붙인 동안 쓴 내용은 웹뷰가 디스크에 남기지 않는다(테스트 도구의 제약).
      // 그래서 디버거를 떼고 실제 터치와 키 입력으로 쓴다.
      await detach()
      await tapText('모국어로 작성하기')
      adb('shell', 'input', 'text', 'draft_kept')
      await wait(1500)
      // AI 채팅 앱으로 가듯 홈 화면으로 나간 뒤, 안드로이드가 메모리 부족으로 앱을 끄는 상황을 흉내 낸다.
      adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
      await wait(5000)
      adb('shell', 'am', 'kill', APP_ID)
      await wait(1500)
      const next = await reconnect()
      await next.evaluate(() => (location.hash = 'journal'))
      await expect(next.getByLabel('모국어로 작성하기')).toHaveValue('draft_kept')
      return next
    },
  ],
]

async function connect() {
  const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`)
  const page = browser.contexts()[0].pages()[0]
  page.setDefaultTimeout(10_000)
  return { browser, page }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  if (!args.includes('--no-build')) build()
  await ensureDevice()
  await launch()

  let { browser, page } = await connect()
  const pageErrors = []
  const watch = (target) => target.on('pageerror', (error) => pageErrors.push(error.message))
  watch(page)
  const detach = async () => {
    await browser.close().catch(() => {})
    adbQuiet('forward', '--remove', `tcp:${PORT}`)
  }
  const reconnect = async () => {
    await browser.close().catch(() => {})
    await launch()
    ;({ browser, page } = await connect())
    watch(page)
    return page
  }

  const results = []
  for (const [name, run] of scenarios) {
    const started = Date.now()
    try {
      const next = await run(page, { detach, reconnect })
      if (next) page = next
      results.push({ name, ok: true, ms: Date.now() - started })
      console.log(`  ✓ ${name}`)
    } catch (error) {
      results.push({ name, ok: false, ms: Date.now() - started, error: String(error.message ?? error).split('\n')[0] })
      console.log(`  ✗ ${name}\n    ${String(error.message ?? error).split('\n')[0]}`)
    }
    await page.screenshot({ path: join(OUT, `${String(results.length).padStart(2, '0')}.png`) }).catch(() => {})
  }

  // 크래시: 우리 앱의 FATAL EXCEPTION, 네이티브 크래시
  const crashLog = adb('logcat', '-d', '-b', 'crash')
  const appCrashes = crashLog.split('\n').filter((line) => line.includes(APP_ID))
  const alive = Boolean(adbQuiet('shell', 'pidof', APP_ID))

  await page.evaluate(() => localStorage.clear()).catch(() => {})
  await browser.close().catch(() => {})
  adbQuiet('forward', '--remove', `tcp:${PORT}`)

  const summary = { device: adb('shell', 'getprop', 'ro.product.model'), android: adb('shell', 'getprop', 'ro.build.version.release'), results, pageErrors, appCrashes, alive }
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  const failed = results.filter((item) => !item.ok).length
  console.log(`\n${results.length - failed}/${results.length} 통과 · 페이지 오류 ${pageErrors.length}개 · 앱 크래시 ${appCrashes.length}줄 · 앱 ${alive ? '실행 중' : '꺼짐'}`)
  console.log(`결과: ${join(OUT, 'summary.json')}`)
  process.exitCode = failed || pageErrors.length || appCrashes.length ? 1 : 0
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
