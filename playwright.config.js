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
      timeout: 120_000,
    },
    {
      // 로그인 화면은 Supabase 환경 변수가 있을 때만 나온다. 값은 테스트용 가짜다.
      command: 'npx vite --port 4174 --strictPort',
      url: 'http://localhost:4174',
      env: {
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-key',
        VITE_AUTH_PROVIDERS: 'google,kakao',
      },
      timeout: 120_000,
    },
  ],
})
