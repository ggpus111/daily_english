// 공유 미리보기 이미지(og-image.png)를 public 폴더에 만든다.
// 앱 아이콘은 scripts/make-app-icons.mjs가 다니 로고로 만든다(그 아이콘을 여기서도 쓴다).
// 실행: node scripts/make-images.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const woff = (name) =>
  readFileSync(`node_modules/pretendard/dist/web/static/woff2/Pretendard-${name}.woff2`).toString('base64')
const FONT = 'PR, sans-serif'
// 다니 로고(책 읽는 다니)는 아이콘 스크립트가 만든 public/icon-512.png를 그대로 쓴다(먼저 make-app-icons.mjs 실행).
const icon = readFileSync('public/icon-512.png').toString('base64')
const ogImage = `
  <style>
    @font-face{font-family:PR;font-weight:400;src:url(data:font/woff2;base64,${woff('Regular')}) format('woff2')}
    @font-face{font-family:PR;font-weight:800;src:url(data:font/woff2;base64,${woff('ExtraBold')}) format('woff2')}
  </style>
  <body style="margin:0">
    <div style="box-sizing:border-box;width:1200px;height:630px;padding:90px;background:#fffaf0;color:#1b1b1b;
      font-family:${FONT};display:flex;flex-direction:column;justify-content:center;gap:26px;border-bottom:24px solid #f6c945">
      <img src="data:image/png;base64,${icon}" width="112" height="112">
      <div style="font-size:84px;font-weight:800;letter-spacing:-0.03em;font-style:italic">Your world. Your words.</div>
      <div style="font-size:36px;color:#4a4036">네가 만나는 세상, 네가 쌓아가는 언어 · Daily English</div>
    </div>
  </body>`

const targets = [['og-image.png', 1200, 630, ogImage, false]]

const browser = await chromium.launch({ channel: 'chrome' })
for (const [name, width, height, html, transparent] of targets) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `public/${name}`, omitBackground: transparent })
  await page.close()
}
await browser.close()

