import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      // .env에 실제 Supabase 값이 있어도 이 서버는 로그인 없는 로컬 모드로 빌드한다.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_AUTH_PROVIDERS: '', VITE_VAPID_PUBLIC_KEY: '' },
      timeout: 240_000,
    },
    {
      // 로그인 화면은 Supabase 환경 변수가 있을 때만 나온다. 값은 테스트용 가짜다.
      // 개발 서버는 첫 화면을 그때 컴파일해서 병렬 실행 중 시간 초과가 나므로, 미리 빌드해서 띄운다.
      command: 'npx vite build --outDir dist-auth && npx vite preview --outDir dist-auth --port 4174 --strictPort',
      url: 'http://localhost:4174',
      env: {
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-key',
        VITE_AUTH_PROVIDERS: 'google,kakao',
      },
      timeout: 240_000,
    },
  ],
})
