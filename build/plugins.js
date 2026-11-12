import { readFileSync } from 'node:fs'

// 배포 주소를 알아야 쓸 수 있는 태그와 파일을 빌드할 때 만든다.
export function siteMeta(siteUrl) {
  const origin = siteUrl?.replace(/\/$/, '')

  return {
    name: 'site-meta',
    transformIndexHtml() {
      if (!origin) return []
      const meta = (property, content) => ({
        tag: 'meta',
        attrs: { property, content },
        injectTo: 'head',
      })
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${origin}/` }, injectTo: 'head' },
        meta('og:url', `${origin}/`),
        meta('og:image', `${origin}/og-image.png`),
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: `${origin}/og-image.png` },
          injectTo: 'head',
        },
      ]
    },
    generateBundle() {
      const sitemapLine = origin ? `\nSitemap: ${origin}/sitemap.xml` : ''
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /${sitemapLine}\n`,
      })
      if (!origin) return
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`,
      })
    },
  }
}

// vite preview에서도 배포와 같은 보안 헤더로 테스트한다.
export function readDeployHeaders() {
  const { headers } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
  const entries = headers
    .find((rule) => rule.source === '/(.*)')
    .headers.filter((header) => header.key !== 'Strict-Transport-Security')
    .map((header) => [
      header.key,
      header.value.replace('; upgrade-insecure-requests', ''),
    ])
  return Object.fromEntries(entries)
}
