// 배포물(dist)과 추적 중인 소스에 비밀 값이 섞여 들어갔는지 검사한다. 걸리면 종료 코드 1.
// 쓰는 법: npm run build && npm run check:secrets
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PATTERNS = [
  ['비밀 개인 키', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Google API 키', /AIza[0-9A-Za-z_-]{30,}/],
  ['Supabase 비밀 키', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['서비스 롤 이름', /service_role/],
  ['VAPID 비밀 키 이름', /VAPID_PRIVATE_KEY/],
  ['Gemini 키 이름', /GEMINI_API_KEY/],
  ['CRON 비밀 값 이름', /CRON_SECRET/],
]
// 소스맵이 있으면 원본 코드가 그대로 노출된다.
const FORBIDDEN_FILES = [/\.map$/]

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

const roots = process.argv.slice(2)
const targets = roots.length ? roots : ['dist']
const problems = []
for (const root of targets) {
  if (!existsSync(root)) {
    console.error(`${root} 폴더가 없습니다. 먼저 npm run build를 하세요.`)
    process.exit(1)
  }
  for (const file of walk(root)) {
    if (FORBIDDEN_FILES.some((re) => re.test(file))) problems.push(`${file}: 소스맵 파일`)
    if (/\.(woff2?|png|jpe?g|webp|ico|svg)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const [label, re] of PATTERNS) if (re.test(text)) problems.push(`${file}: ${label}`)
  }
}

if (problems.length) {
  console.error('비밀 값이 배포물에 들어갔을 수 있습니다:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`비밀 값 검사 통과 (${targets.join(', ')})`)
