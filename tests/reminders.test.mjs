import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function worker(windows = []) {
  const events = {}, shown = [], opened = []
  const self = {
    location: { origin: 'https://pocket.test' },
    addEventListener: (name, handler) => { events[name] = handler },
    registration: { showNotification: async (...args) => { shown.push(args) } },
    clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url) } },
  }
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL })
  return { events, shown, opened }
}
test('a payload-free push displays the daily reminder while the page is closed', async () => {
  const { events, shown } = worker()
  let completion
  events.push({ waitUntil: promise => { completion = promise } })
  await completion
  assert.equal(shown.length, 1)
  assert.equal(shown[0][1].tag, 'pocket-daily-reminder')
  assert.match(shown[0][1].body, /expenses/)
})
test('notification opens Pocket when no window is open', async () => {
  const { events, opened } = worker()
  let closed = false, completion
  events.notificationclick({ notification: { close: () => { closed = true } }, waitUntil: promise => { completion = promise } })
  await completion
  assert.ok(closed)
  assert.deepEqual(opened, ['/'])
})
test('notification focuses an existing Pocket window', async () => {
  let focused = false, completion
  const { events, opened } = worker([{ url: 'https://pocket.test/', focus: async () => { focused = true } }])
  events.notificationclick({ notification: { close() {} }, waitUntil: promise => { completion = promise } })
  await completion
  assert.ok(focused)
  assert.deepEqual(opened, [])
})
