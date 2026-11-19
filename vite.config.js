import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readDeployHeaders, siteMeta } from './build/plugins.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 안드로이드 앱 빌드(--mode app)는 파일을 앱 안에 담으므로 서비스 워커가 필요 없다.
  const isApp = mode === 'app'
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

  return {
    // 오류 보고에 앱 버전을 남긴다(src/lib/errorLog.js).
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      react(),
      siteMeta(env.VITE_SITE_URL),
      !isApp &&
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          id: '/',
          name: 'Daily English',
          short_name: 'Daily English',
          description: '단어, 표현, 대화, 일기를 모으는 언어 학습 기록 앱',
          lang: 'ko',
          start_url: '/',
          scope: '/',
          theme_color: '#FFFDFA',
          background_color: '#F4F0EB',
          display: 'standalone',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    preview: { headers: readDeployHeaders() },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
    },
  }
})
