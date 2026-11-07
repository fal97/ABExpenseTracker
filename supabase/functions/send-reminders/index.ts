import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (request.headers.get('x-cron-secret') !== required('REMINDER_CRON_SECRET')) return new Response('Unauthorized', { status: 401 })
  const db = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'))
  webpush.setVapidDetails(required('VAPID_SUBJECT'), required('VAPID_PUBLIC_KEY'), required('VAPID_PRIVATE_KEY'))
  const { data: reminders, error } = await db.rpc('claim_due_reminders')
  if (error) return new Response('Could not claim reminders', { status: 500 })
  let sent = 0
  let failed = 0
  // Limit concurrent outbound requests and keep endpoint/key material out of logs.
  for (let start = 0; start < reminders.length; start += 10) {
    await Promise.all(reminders.slice(start, start + 10).map(async (row: { id: string; endpoint: string; p256dh: string; auth: string; time_zone: string }) => {
      try {
        const host = new URL(row.endpoint).hostname
        if (!(host === 'web.push.apple.com' || host.endsWith('.push.apple.com') || host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.notify.windows.com'))) {
          await db.from('push_reminders').delete().eq('id', row.id)
          failed++; return
        }
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, null, { TTL: 3600, timeout: 15000 })
        const parts = new Intl.DateTimeFormat('en', { timeZone: row.time_zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
        const part = (type: string) => parts.find(item => item.type === type)!.value
        const date = `${part('year')}-${part('month')}-${part('day')}`
        const result = await db.from('push_reminders').update({ last_sent_date: date, claimed_until: null }).eq('id', row.id)
        if (result.error) throw result.error
        sent++
      } catch (error) {
        failed++
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.from('push_reminders').delete().eq('id', row.id)
        // Other failures retry once the claim expires.
      }
    }))
  }
  return Response.json({ sent, failed })
})
