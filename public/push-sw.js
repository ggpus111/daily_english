// 웹 푸시 알림을 받는 서비스 워커 조각. vite.config.js의 workbox.importScripts로 서비스 워커에 들어간다.
// 서버 함수(supabase/functions/send-reminders)가 보낸 { title, body, url, tag }를 알림으로 보여 주고,
// 누르면 앱의 알맞은 화면(#words, #journal)을 연다. 이미 열린 창이 있으면 그 창을 쓴다.
self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Daily English'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'daily-english',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // 알림에 담긴 주소가 이 앱 밖이면 열지 않고 처음 화면으로 보낸다.
  const wanted = new URL(event.notification.data?.url || '/', self.location.origin)
  const target = (wanted.origin === self.location.origin ? wanted : new URL('/', self.location.origin)).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin))
      if (open) return open.navigate(target).then((client) => (client ?? open).focus())
      return self.clients.openWindow(target)
    }),
  )
})
