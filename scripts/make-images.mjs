// 앱 아이콘과 공유 미리보기 이미지를 public 폴더에 만든다.
// 실행: node scripts/make-images.mjs
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const FONT = "'Malgun Gothic', Arial, sans-serif"
const icon = (size, inset) => `
  <body style="margin:0;background:transparent">
    <div style="display:grid;place-items:center;width:${size}px;height:${size}px;background:#e9a58e;
      border-radius:${inset ? 0 : size * 0.23}px;color:#2f2a26;font:700 ${size * (inset ? 0.42 : 0.55)}px ${FONT}">d.</div>
  </body>`
const ogImage = `
  <body style="margin:0">
    <div style="box-sizing:border-box;width:1200px;height:630px;padding:90px;background:#f4eee8;color:#2f2a26;
      font-family:${FONT};display:flex;flex-direction:column;justify-content:center;gap:28px">
      <div style="display:grid;place-items:center;width:96px;height:96px;border-radius:26px;background:#e9a58e;
        font-size:48px;font-weight:700">d.</div>
      <div style="font-size:76px;font-weight:700;letter-spacing:-2px">Daily English</div>
      <div style="font-size:36px;color:#6f6258">단어, 표현, 대화, 일기를 모으는 나만의 언어 기록장</div>
      <div style="display:flex;gap:14px">
        <span style="width:150px;height:18px;border-radius:9px;background:#f4c0a9"></span>
        <span style="width:150px;height:18px;border-radius:9px;background:#d7d3e7"></span>
        <span style="width:150px;height:18px;border-radius:9px;background:#d3ddcd"></span>
        <span style="width:150px;height:18px;border-radius:9px;background:#f2e4bd"></span>
      </div>
    </div>
  </body>`

const targets = [
  ['icon-192.png', 192, 192, icon(192, false), true],
  ['icon-512.png', 512, 512, icon(512, false), true],
  ['icon-maskable.png', 512, 512, icon(512, true), false],
  ['apple-touch-icon.png', 180, 180, icon(180, true), false],
  ['favicon-48.png', 48, 48, icon(48, false), true],
  ['og-image.png', 1200, 630, ogImage, false],
]

const browser = await chromium.launch({ channel: 'chrome' })
for (const [name, width, height, html, transparent] of targets) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.setContent(html)
  await page.screenshot({ path: `public/${name}`, omitBackground: transparent })
  await page.close()
}
await browser.close()

// ICO 컨테이너 안에 PNG 한 장을 넣는다.
import { readFileSync, unlinkSync } from 'node:fs'
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
