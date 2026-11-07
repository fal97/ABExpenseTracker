import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
function applicationKey(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}

export default function ReminderSettings({ client, user }: { client: SupabaseClient | null; user: string | null }) {
  const [time, setTime] = useState('20:00')
  const [zone, setZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(() => !!(client && user && publicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [issue, setIssue] = useState('')
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  useEffect(() => {
    let active = true
    if (!client || !user || !supported || !publicKey) return
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) return
        const result = await client.from('push_reminders').select('reminder_time,time_zone').eq('user_id', user).eq('endpoint', subscription.endpoint).maybeSingle()
        if (result.error) throw result.error
        if (active && result.data) { setTime(result.data.reminder_time.slice(0, 5)); setZone(result.data.time_zone); setEnabled(true) }
      } catch { if (active) setIssue('Could not load reminder settings. Reload to try again.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [client, user, supported])
  async function save(disable = false) {
    if (!client || !user || !publicKey) return
    setBusy(true); setIssue(''); setMessage('')
    try {
      // Request permission directly from the user's tap, before asynchronous setup.
      if (!disable && await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked. Allow notifications in your device settings, then try again.')
      await navigator.serviceWorker.register('/sw.js')
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (disable) {
        if (subscription) {
          const result = await client.from('push_reminders').delete().eq('user_id', user).eq('endpoint', subscription.endpoint)
          if (result.error) throw result.error
        }
        setEnabled(false); setMessage('Daily reminders are off for this account on this device.')
      } else {
        subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) })
        const json = subscription.toJSON()
        const result = await client.from('push_reminders').upsert({ user_id: user, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, reminder_time: time, time_zone: zone }, { onConflict: 'user_id,endpoint' })
        if (result.error) throw result.error
        setEnabled(true); setMessage(`Daily reminder saved for ${time} (${zone}) on this device.`)
      }
    } catch (error) { setIssue(error instanceof Error ? error.message : 'Unable to save the reminder. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="panel"><h2>Daily expense reminder</h2><p>A little nudge to record your spending, even when Pocket is closed.</p>
    {iphone && !standalone && <p>On iPhone or iPad, use Share → Add to Home Screen, then open Pocket from its icon to enable reminders.</p>}
    {!supported && !(iphone && !standalone) && <p>This browser does not support push notifications. Try a supported browser.</p>}
    {!client && <p>Sign in with a cloud account to enable daily reminders.</p>}
    {!publicKey && <p>Reminders are awaiting server setup.</p>}
    <form onSubmit={e => { e.preventDefault(); void save() }}><label>Remind me at<input type="time" value={time} required onChange={e => setTime(e.target.value)}/></label>
      <label>Time zone<input value={zone} required onChange={e => setZone(e.target.value)} list="reminder-zones"/></label>
      <datalist id="reminder-zones">{[...new Set([Intl.DateTimeFormat().resolvedOptions().timeZone, 'Asia/Colombo', 'UTC'])].map(value => <option key={value} value={value}/>)}</datalist>
      <p className="muted">Uses this time zone even while you travel. Internet access is required; Focus settings may silence alerts.</p>
      <button className="primary" disabled={loading || busy || !supported || !client || !publicKey || !!(iphone && !standalone)}>{busy ? 'Saving…' : enabled ? 'Save reminder' : 'Enable daily reminder'}</button>
      {enabled && <button type="button" disabled={busy || loading} onClick={() => void save(true)}>Turn off reminder</button>}
    </form>{message && <p role="status">{message}</p>}{issue && <p className="error" role="alert">{issue}</p>}
  </section>
}
