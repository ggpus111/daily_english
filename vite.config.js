import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readDeployHeaders, siteMeta } from './build/plugins.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      siteMeta(env.VITE_SITE_URL),
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
          background_color: '#F4EEE8',
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
