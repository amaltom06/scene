import test from 'node:test'
import assert from 'node:assert/strict'
import { dateRange, eventCalendar } from '../shared/events.js'

test('date shortcuts produce full local days, including the current Sunday', () => {
  const monday = new Date(2026, 9, 12, 15, 30)
  const today = dateRange('today', monday)
  assert.equal(new Date(today.from).getDate(), 12)
  assert.equal(new Date(today.from).getHours(), 0)
  assert.equal(new Date(today.to).getDate(), 13)
  assert.equal(new Date(dateRange('tomorrow', monday).from).getDate(), 13)
  const weekend = dateRange('weekend', monday)
  assert.equal(new Date(weekend.from).getDay(), 6)
  assert.equal(new Date(weekend.to).getDay(), 1)
  const sunday = dateRange('weekend', new Date(2026, 9, 18, 15))
  assert.equal(new Date(sunday.from).getDate(), 17)
  assert.equal(new Date(sunday.to).getDate(), 19)
  assert.equal(dateRange('all', monday), null)
})

test('calendar exports preserve absolute times, escape content and include a reminder', () => {
  const calendar = eventCalendar({ id: 'abc123', title: 'Coffee, art; together\nTonight', description: 'Bring a friend, a mug; and ideas.', city: 'Kochi', venue: 'Cafe', address: 'Main road', startsAt: '2026-10-17T18:00:00+05:30', endsAtDate: '2026-10-17T20:00:00+05:30' }, 'https://scene.example', new Date('2026-10-12T10:00:00Z'))
  assert.ok(calendar.includes('DTSTART:20261017T123000Z\r\n'))
  assert.ok(calendar.includes('DTEND:20261017T143000Z\r\n'))
  assert.ok(calendar.includes('SUMMARY:Coffee\\, art\\; together\\nTonight\r\n'))
  assert.ok(calendar.includes('LOCATION:Cafe\\, Main road\\, Kochi\r\n'))
  assert.ok(calendar.includes('URL:https://scene.example/?scene=abc123\r\n'))
  assert.ok(calendar.includes('TRIGGER:-PT1H\r\n'))
  assert.ok(calendar.includes('STATUS:CONFIRMED\r\n'))
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'))
})

test('calendar folds UTF-8 lines without corrupting text and distinguishes cancelled events', () => {
  const title = '🎵 സംഗീതം '.repeat(24)
  const calendar = eventCalendar({ _id: 'abc123', title, locationType: 'online', status: 'cancelled', startsAt: '2026-10-17T12:00:00Z', endsAtDate: '2026-10-17T14:00:00Z' }, 'https://scene.example')
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
  assert.ok(calendar.replace(/\r\n /g, '').includes('SUMMARY:' + title))
  assert.ok(calendar.includes('LOCATION:Online\r\n'))
  assert.ok(calendar.includes('STATUS:CANCELLED\r\n'))
  assert.throws(() => eventCalendar({ title: 'Unscheduled' }, 'https://scene.example'), /calendar schedule/)
})
