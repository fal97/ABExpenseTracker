self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('Your daily Pocket reminder', {
    body: 'Take a moment to record today’s expenses.',
    tag: 'pocket-daily-reminder',
    icon: '/favicon.svg',
    data: { url: '/' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) return client.focus()
    }
    return self.clients.openWindow('/')
  })())
})
