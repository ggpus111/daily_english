// 웹 알림 보내기 (Supabase Edge Function).
// supabase/push-cron.sql의 예약 작업이 10분마다 부른다. push_queue에서 보낼 때가 된 알림을 골라
// 그 사용자의 브라우저(push_subscriptions)로 웹 푸시를 보내고, 보낸 줄은 지운다.
// - 1시간 넘게 늦은 알림은 보내지 않고 지운다(서버가 멈췄다 돌아와도 한꺼번에 쏟아지지 않게).
// - 브라우저가 구독을 끊었으면(404, 410) 그 푸시 주소를 지운다.
//
// 필요한 비밀 값(Supabase 대시보드 > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(예: mailto:문의 이메일)
// SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 넣어 준다.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const LATE_LIMIT_MS = 60 * 60 * 1000
const BATCH = 500

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

type Row = { id: number; user_id: string; send_at: string; kind: string; title: string; body: string; url: string }
type Subscription = { endpoint: string; user_id: string; p256dh: string; auth: string }

Deno.serve(async () => {
  const now = Date.now()
  const { data: due, error } = await supabase
    .from('push_queue')
    .select('*')
    .lte('send_at', new Date(now).toISOString())
    .order('send_at')
    .limit(BATCH)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const rows = (due ?? []) as Row[]
  if (!rows.length) return Response.json({ sent: 0 })

  const fresh = rows.filter((row) => now - Date.parse(row.send_at) <= LATE_LIMIT_MS)
  const userIds = [...new Set(fresh.map((row) => row.user_id))]
  const { data: subs } = userIds.length
    ? await supabase.from('push_subscriptions').select('*').in('user_id', userIds)
    : { data: [] }
  const byUser = new Map<string, Subscription[]>()
  for (const sub of (subs ?? []) as Subscription[]) byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub])

  // 한 사람에게 같은 종류 알림이 여러 개 밀려 있으면 가장 최근 것 하나만 보낸다.
  const latest = new Map<string, Row>()
  for (const row of fresh) latest.set(`${row.user_id}|${row.kind}`, row)

  let sent = 0
  const gone = new Set<string>()
  for (const row of latest.values()) {
    const payload = JSON.stringify({ title: row.title, body: row.body, url: row.url, tag: `daily-english-${row.kind}` })
    for (const sub of byUser.get(row.user_id) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 })
        sent += 1
      } catch (pushError) {
        const status = (pushError as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.add(sub.endpoint)
      }
    }
  }

  await supabase.from('push_queue').delete().in('id', rows.map((row) => row.id))
  if (gone.size) await supabase.from('push_subscriptions').delete().in('endpoint', [...gone])
  return Response.json({ sent, removed: rows.length, expired: gone.size })
})
