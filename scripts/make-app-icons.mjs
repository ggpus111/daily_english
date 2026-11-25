// 앱 아이콘·파비콘은 다니 로고(src/components/Logo.jsx: 노란 둥근 사각형 안에서 책 읽는 다니)로, 시작 화면은 말새 캐릭터로 만든다.
// 다니와 캐릭터는 실제 화면(src/components/Dani.jsx, Mascot.jsx)에서 그려 가져온다.
// 실행: npm run dev 를 켜 둔 상태에서 node scripts/make-app-icons.mjs [개발 서버 주소]
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const DEV_URL = process.argv[2] ?? 'http://localhost:5173/'
const RES = 'android/app/src/main/res/'
// 다니 테마 로고 색(src/theme-dani.css의 .dani-logo-mark)
const YELLOW = '#f6c945'
const INK = '#1b1b1b'
const CREAM = '#f4f0eb'
const FONT = readFileSync('node_modules/pretendard/dist/web/static/woff2/Pretendard-ExtraBold.woff2').toString('base64')

const browser = await chromium.launch({ channel: 'chrome' })

// 1. 화면에 그려진 캐릭터를 CSS 변수 없는 독립 SVG로 바꾼다.
const page = await browser.newPage()
// 첫 실행 안내를 건너뛰어 홈(캐릭터가 있는 칸)이 바로 보이게 한다.
await page.addInitScript(() => {
  localStorage.setItem('onboarded', '1')
  localStorage.setItem('guestMode', '1') // 서버에 연결된 개발 서버도 로그인 화면 대신 홈이 보이게
})
await page.goto(DEV_URL)
await page.waitForSelector('.quote-panel svg')
await page.waitForSelector('.dani-logo-mark svg')
// 화면의 SVG를 CSS 변수 없는 독립 SVG로 바꾼다.
const standalone = (selector) =>
  page.evaluate((selector) => {
    const source = document.querySelector(selector)
    const copy = source.cloneNode(true)
    const style = getComputedStyle(document.documentElement)
    copy.querySelectorAll('*').forEach((node) => {
      for (const attr of ['fill', 'stroke']) {
        const value = node.getAttribute(attr)
        const match = value?.match(/^var\((--[\w-]+)\)$/)
        if (match) node.setAttribute(attr, style.getPropertyValue(match[1]).trim())
      }
    })
    copy.removeAttribute('class')
    copy.removeAttribute('aria-hidden')
    copy.removeAttribute('width')
    copy.removeAttribute('height')
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    return copy.outerHTML
  }, selector)
const svg = await standalone('.quote-panel svg')
const daniSvg = await standalone('.dani-logo-mark svg')
await page.close()
const daniUrl = `data:image/svg+xml;base64,${Buffer.from(daniSvg).toString('base64')}`
writeFileSync('public/mascot.svg', svg)
const mascotUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

// 2. 배경, 모양, 그림 크기를 정해 PNG로 찍는다. logo가 true면 캐릭터 대신 책 읽는 다니를 그린다.
// border가 true면 로고처럼 검은 테두리를 두른다(테두리 두께는 크기에 비례).
async function render(
  path,
  width,
  height,
  { background = 'transparent', radius = 0, scale = 0.8, logo = false, border = false } = {},
) {
  const shot = await browser.newPage({ viewport: { width, height } })
  const size = Math.round(Math.min(width, height) * scale)
  const art = `<img src="${logo ? daniUrl : mascotUrl}" width="${size}" height="${size}">`
  const line = border
    ? `border:${Math.max(1, Math.round(Math.min(width, height) * 0.055))}px solid ${INK};box-sizing:border-box;`
    : ''
  await shot.setContent(`
    <style>@font-face{font-family:PB;src:url(data:font/woff2;base64,${FONT}) format('woff2')}</style>
    <body style="margin:0;background:transparent">
      <div style="width:${width}px;height:${height}px;display:grid;place-items:center;overflow:hidden;
        background:${background};border-radius:${radius};${line}">${art}</div>
    </body>`)
  await shot.evaluate(() => document.fonts.ready)
  await shot.screenshot({ path, omitBackground: true })
  await shot.close()
}

const DENSITIES = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]
for (const [density, launcher, foreground] of DENSITIES) {
  const dir = `${RES}mipmap-${density}/`
  await render(`${dir}ic_launcher.png`, launcher, launcher, {
    background: YELLOW,
    radius: '28%',
    scale: 0.92,
    logo: true,
    border: true,
  })
  await render(`${dir}ic_launcher_round.png`, launcher, launcher, {
    background: YELLOW,
    radius: '50%',
    scale: 0.82,
    logo: true,
    border: true,
  })
  // 적응형 아이콘은 가운데 66/108 안쪽만 항상 보이므로 그 안에 들어가게 한다.
  await render(`${dir}ic_launcher_foreground.png`, foreground, foreground, {
    scale: 0.62,
    logo: true,
  })
}

const SPLASH = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
]
for (const [dir, width, height] of SPLASH) {
  await render(`${RES}${dir}/splash.png`, width, height, {
    background: CREAM,
    scale: 0.36,
  })
}

// 3. 웹 아이콘(파비콘, 홈 화면 아이콘)도 같은 다니 로고로 맞춘다.
await render('public/icon-192.png', 192, 192, {
  background: YELLOW,
  radius: '28%',
  scale: 0.92,
  logo: true,
  border: true,
})
await render('public/icon-512.png', 512, 512, {
  background: YELLOW,
  radius: '28%',
  scale: 0.92,
  logo: true,
  border: true,
})
await render('public/icon-maskable.png', 512, 512, {
  background: YELLOW,
  scale: 0.72,
  logo: true,
})
await render('public/apple-touch-icon.png', 180, 180, {
  background: YELLOW,
  scale: 0.86,
  logo: true,
})
await render('public/favicon-48.png', 48, 48, {
  background: YELLOW,
  radius: '28%',
  scale: 0.92,
  logo: true,
  border: true,
})
// SVG 아이콘은 보는 기기의 글꼴에 기대지 않게, 찍은 PNG를 담는다.
const iconPng = readFileSync('public/icon-512.png').toString('base64')
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="data:image/png;base64,${iconPng}" width="512" height="512"/></svg>\n`,
)

await browser.close()

// ICO 컨테이너 안에 PNG 한 장을 넣는다.
const png = readFileSync('public/favicon-48.png')
const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header[6] = 48
header[7] = 48
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14)
header.writeUInt32LE(22, 18)
writeFileSync('public/favicon.ico', Buffer.concat([header, png]))
unlinkSync('public/favicon-48.png')
console.log('icons and splash images written')
