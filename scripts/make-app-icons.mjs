// 앱 아이콘·파비콘은 "d." 로고(src/components/Logo.jsx)로, 시작 화면은 말랑이 캐릭터로 만든다.
// 캐릭터는 src/components/Mascot.jsx를 실제 화면에서 그려 가져온다.
// 실행: npm run dev 를 켜 둔 상태에서 node scripts/make-app-icons.mjs [개발 서버 주소]
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const DEV_URL = process.argv[2] ?? 'http://localhost:5173/'
const RES = 'android/app/src/main/res/'
const PEACH = '#d39a85'
const CREAM = '#f4f0eb'
const FONT = readFileSync('node_modules/pretendard/dist/web/static/woff2/Pretendard-ExtraBold.woff2').toString('base64')

// Logo.jsx의 LogoMark와 같은 모양에서 바탕만 뺀 흰 "d."
const LOGO_GLYPH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <text x="45" y="68" text-anchor="middle" font-family="PB" font-size="62" letter-spacing="-2" fill="#fff">d</text>
  <circle cx="72" cy="63" r="6" fill="#fff"/></svg>`

const browser = await chromium.launch({ channel: 'chrome' })

// 1. 화면에 그려진 캐릭터를 CSS 변수 없는 독립 SVG로 바꾼다.
const page = await browser.newPage()
await page.goto(DEV_URL)
await page.waitForSelector('.quote-panel .mascot')
const svg = await page.evaluate(() => {
  const source = document.querySelector('.quote-panel .mascot')
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
})
await page.close()
writeFileSync('public/mascot.svg', svg)
const mascotUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

// 2. 배경, 모양, 그림 크기를 정해 PNG로 찍는다. logo가 true면 캐릭터 대신 흰 "d."를 그린다.
async function render(path, width, height, { background = 'transparent', radius = 0, scale = 0.8, logo = false } = {}) {
  const shot = await browser.newPage({ viewport: { width, height } })
  const size = Math.round(Math.min(width, height) * scale)
  const art = logo
    ? `<div style="width:${size}px;height:${size}px">${LOGO_GLYPH}</div>`
    : `<img src="${mascotUrl}" width="${size}" height="${size}">`
  await shot.setContent(`
    <style>@font-face{font-family:PB;src:url(data:font/woff2;base64,${FONT}) format('woff2')}</style>
    <body style="margin:0;background:transparent">
      <div style="width:${width}px;height:${height}px;display:grid;place-items:center;
        background:${background};border-radius:${radius}">${art}</div>
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
  await render(`${dir}ic_launcher.png`, launcher, launcher, { background: PEACH, radius: '26%', scale: 1, logo: true })
  await render(`${dir}ic_launcher_round.png`, launcher, launcher, { background: PEACH, radius: '50%', scale: 0.9, logo: true })
  // 적응형 아이콘은 가운데 66/108 안쪽만 항상 보이므로 그 안에 들어가게 한다.
  await render(`${dir}ic_launcher_foreground.png`, foreground, foreground, { scale: 0.62, logo: true })
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
  await render(`${RES}${dir}/splash.png`, width, height, { background: CREAM, scale: 0.36 })
}

// 3. 웹 아이콘도 같은 "d." 로고로 맞춘다.
await render('public/icon-192.png', 192, 192, { background: PEACH, radius: '26%', scale: 1, logo: true })
await render('public/icon-512.png', 512, 512, { background: PEACH, radius: '26%', scale: 1, logo: true })
await render('public/icon-maskable.png', 512, 512, { background: PEACH, scale: 0.78, logo: true })
await render('public/apple-touch-icon.png', 180, 180, { background: PEACH, scale: 0.9, logo: true })
await render('public/favicon-48.png', 48, 48, { background: PEACH, radius: '26%', scale: 1, logo: true })
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
