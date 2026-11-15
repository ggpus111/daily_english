// 공유 미리보기 이미지(og-image.png)를 public 폴더에 만든다.
// 앱 아이콘은 scripts/make-app-icons.mjs가 "d." 로고로 만든다.
// 실행: node scripts/make-images.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const woff = (name) =>
  readFileSync(`node_modules/pretendard/dist/web/static/woff2/Pretendard-${name}.woff2`).toString('base64')
const FONT = 'PR, sans-serif'
const ogImage = `
  <style>
    @font-face{font-family:PR;font-weight:400;src:url(data:font/woff2;base64,${woff('Regular')}) format('woff2')}
    @font-face{font-family:PR;font-weight:800;src:url(data:font/woff2;base64,${woff('ExtraBold')}) format('woff2')}
  </style>
  <body style="margin:0">
    <div style="box-sizing:border-box;width:1200px;height:630px;padding:90px;background:#f4f0eb;color:#3a2b22;
      font-family:${FONT};display:flex;flex-direction:column;justify-content:center;gap:28px">
      <svg width="104" height="104" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="#d39a85"/>
        <text x="45" y="68" text-anchor="middle" font-family="PR" font-weight="800" font-size="62" letter-spacing="-2" fill="#fff">d</text>
        <circle cx="72" cy="63" r="6" fill="#fff"/></svg>
      <div style="font-size:84px;font-weight:800;letter-spacing:-0.03em">daily english</div>
      <div style="font-size:36px;color:#6d5a4d">단어, 표현, 대화, 일기를 모으는 나만의 언어 기록장</div>
      <div style="display:flex;gap:14px">
        <span style="width:150px;height:18px;border-radius:9px;background:#f4c0a9"></span>
        <span style="width:150px;height:18px;border-radius:9px;background:#d7d3e7"></span>
        <span style="width:150px;height:18px;border-radius:9px;background:#d3ddcd"></span>
        <span style="width:150px;height:18px;border-radius:9px;background:#f2e4bd"></span>
      </div>
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

