export const eventCategories = [
  'Concerts', 'Comedy', 'Theatre', 'Movie Screenings', 'DJ Nights', 'Nightlife',
  'Parties', 'Festivals', 'College Festivals', 'Workshops', 'Sports', 'Gaming',
  'Food Meetups', 'Art and Culture', 'Networking', 'Outdoor Activities',
  'Wellness', 'Kids and Family', 'Experiences', 'Casual Hangouts', 'Community Events',
]

export const dateRange = (preset, now = new Date()) => {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  if (preset === 'tomorrow') from.setDate(from.getDate() + 1)
  else if (preset === 'weekend') {
    const day = from.getDay()
    from.setDate(from.getDate() + (day === 0 ? -1 : (6 - day + 7) % 7))
  } else if (preset !== 'today') return null
  to.setTime(from.getTime())
  to.setDate(to.getDate() + (preset === 'weekend' ? 2 : 1))
  return { from: from.toISOString(), to: to.toISOString() }
}

const calendarText = (value = '') => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const calendarDate = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const foldLine = (line) => {
  let current = ''; let length = 0; const lines = []
  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length
    if (length + bytes > 75) { lines.push(current); current = ' '; length = 1 }
    current += character; length += bytes
  }
  lines.push(current)
  return lines.join('\r\n')
}

export function eventCalendar(scene, origin, now = new Date()) {
  if (!scene.startsAt || !scene.endsAtDate || !Number.isFinite(new Date(scene.startsAt).getTime()) || !Number.isFinite(new Date(scene.endsAtDate).getTime())) throw new Error('This Scene does not have a calendar schedule yet.')
  const id = scene.id || scene._id
  const url = new URL('/?scene=' + encodeURIComponent(id), origin).href
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SCENE//Event Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${calendarText(id)}@scene`, `DTSTAMP:${calendarDate(now)}`,
    `DTSTART:${calendarDate(scene.startsAt)}`, `DTEND:${calendarDate(scene.endsAtDate)}`,
    `SUMMARY:${calendarText(scene.title)}`,
    `DESCRIPTION:${calendarText([scene.description, scene.instructions, url].filter(Boolean).join('\n\n'))}`,
    `LOCATION:${calendarText(scene.locationType === 'online' ? 'Online' : [scene.venue, scene.address, scene.city].filter(Boolean).join(', '))}`,
    `URL:${url}`, `STATUS:${scene.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${calendarText(scene.title)} starts in one hour.`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldLine).join('\r\n')
}
