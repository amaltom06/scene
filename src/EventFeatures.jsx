import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ArrowRight, Bookmark, CalendarDays, Check, Clock3, Clapperboard, Compass, Download, Heart, Leaf, MapPin, Mic2, Music2, Palette, PartyPopper, Sparkles, Ticket, Trophy, X } from 'lucide-react'
import { eventCalendar } from '../shared/events.js'

export const EventActionsContext = createContext({ savedIds: [], savingIds: [], onSave: () => {} })
const apiBase = import.meta.env.VITE_API_BASE_URL || ''

export function useDialogFocus(version = false) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    dialog.querySelector(selector)?.focus()
    const trap = (event) => {
      if (event.key !== 'Tab') return
      const elements = [...dialog.querySelectorAll(selector)].filter((element) => element.getClientRects().length > 0)
      const first = elements[0]; const last = elements.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [version])
  return ref
}

export function SaveSceneButton({ scene, label = false }) {
  const { savedIds, savingIds, onSave } = useContext(EventActionsContext)
  const saved = savedIds.includes(scene.id)
  if (scene.publication === 'draft') return null
  return <button className={'save-scene ' + (saved ? 'is-saved' : '') + (label ? ' with-label' : '')} aria-label={saved ? 'Remove ' + scene.title + ' from saved events' : 'Save ' + scene.title} aria-pressed={saved} disabled={savingIds.includes(scene.id)} onClick={() => onSave(scene)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />{label && (saved ? 'SAVED' : 'SAVE EVENT')}</button>
}

const browseCategories = [
  { name: 'Concerts', label: 'Live music', Icon: Music2, color: 'lime' },
  { name: 'Comedy', label: 'Comedy', Icon: Mic2, color: 'red' },
  { name: 'Movie Screenings', label: 'Screenings', Icon: Clapperboard, color: 'blue' },
  { name: 'Workshops', label: 'Workshops', Icon: Palette, color: 'orange' },
  { name: 'Nightlife', label: 'Nightlife', Icon: PartyPopper, color: 'purple' },
  { name: 'Sports', label: 'Sports', Icon: Trophy, color: 'lime' },
  { name: 'Outdoor Activities', label: 'Outdoors', Icon: Compass, color: 'blue' },
  { name: 'Wellness', label: 'Wellness', Icon: Leaf, color: 'orange' },
]

export function CategoryBrowser({ onExplore }) {
  return <section className="category-browser"><div className="browse-heading"><span>WHAT ARE YOU IN THE MOOD FOR?</span><button onClick={() => onExplore({})}>ALL CATEGORIES <ArrowRight size={14} /></button></div><div className="category-tiles">{browseCategories.map(({ name, label, Icon, color }) => <button key={name} className={'category-tile ' + color} onClick={() => onExplore({ category: name })}><Icon size={25} strokeWidth={1.6} /><span>{label}</span><ArrowRight size={13} /></button>)}</div></section>
}

export function DiscoveryShortcuts({ onExplore, onPlans }) {
  return <div className="discovery-shortcuts"><button onClick={() => onExplore({ datePreset: 'today' })}><Clock3 size={16} />TODAY</button><button onClick={() => onExplore({ datePreset: 'weekend' })}><CalendarDays size={16} />THIS WEEKEND</button><button onClick={() => onExplore({ price: 'free' })}><Sparkles size={16} />FREE PLANS</button><button onClick={() => onExplore({ mode: 'map' })}><MapPin size={16} />NEARBY</button><button onClick={onPlans}><Ticket size={16} />MY PLANS</button></div>
}

export async function shareScene(scene, notify) {
  const url = `${window.location.origin}/?scene=${scene.id || scene._id}`
  try {
    if (navigator.share) await navigator.share({ title: scene.title, text: 'Join me at ' + scene.title, url })
    else { await navigator.clipboard.writeText(url); notify('Scene link copied. Share it with your people.') }
  } catch (error) { if (error.name !== 'AbortError') notify('Your browser could not share this Scene.') }
}

export function downloadCalendar(scene, notify) {
  try {
    const file = new Blob([eventCalendar(scene, window.location.origin)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url; link.download = 'scene-' + (scene.id || scene._id) + '.ics'
    document.body.appendChild(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('Calendar event downloaded with a one-hour reminder.')
  } catch (error) { notify(error.message) }
}

export function DirectionsLink({ scene }) {
  if (scene.locationType === 'online') return null
  const destination = Number.isFinite(scene.latitude) && Number.isFinite(scene.longitude) ? `${scene.latitude},${scene.longitude}` : [scene.venue, scene.address, scene.area, scene.city].filter(Boolean).join(', ')
  return <a className="event-tool" href={'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination)} target="_blank" rel="noopener noreferrer"><MapPin size={16} />DIRECTIONS</a>
}

export function PassDialog({ scene, onClose, notify }) {
  const dialogRef = useDialogFocus()
  const [pass, setPass] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(apiBase + '/api/scenes/' + scene.id + '/pass', { credentials: 'include', signal: controller.signal }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPass(data)
    }).catch((error) => { if (error.name !== 'AbortError') setError(error.message || 'Your pass could not be loaded.') })
    return () => controller.abort()
  }, [scene.id])
  useEffect(() => { const close = (event) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  const event = pass?.scene
  return <div className="overlay" onMouseDown={onClose}><section ref={dialogRef} className="modal pass-modal" role="dialog" aria-modal="true" aria-labelledby="pass-heading" onMouseDown={(event) => event.stopPropagation()}><button className="close" aria-label="Close pass" onClick={onClose}><X /></button><p className="eyebrow"><i />YOUR NEXT REAL-WORLD MEMORY</p><h2 id="pass-heading">YOUR <span>PASS.</span></h2>{error ? <p className="form-error" role="alert">{error}</p> : !pass ? <p className="loading-note" role="status">Opening your reservation...</p> : <><div className={'entry-pass ' + (pass.status !== 'CONFIRMED' ? 'inactive-pass' : '')}><div className="pass-top"><span className="logo">SCENE<span>.</span></span><b><Check size={14} />{pass.status}</b></div><p className="pass-category">{event.category} / {event.city}</p><h3>{event.title}</h3><div className="pass-facts"><span><CalendarDays size={16} /><b>{event.date}</b><small>{event.time} · {event.timezone}</small></span><span><MapPin size={16} /><b>{event.locationType === 'online' ? 'Online' : event.venue}</b><small>{event.address || event.area}</small></span></div><div className="pass-stub"><span><small>RESERVED FOR</small><b>{pass.attendee}</b></span><span><small>ADMISSION</small><b>{pass.quantity} person · Free</b></span></div><div className="pass-reference"><Ticket size={24} /><div><small>RESERVATION REFERENCE</small><strong>{pass.reference}</strong></div></div></div><p className="pass-note">{pass.status === 'CANCELLED' ? 'The organiser cancelled this Scene. This reservation is no longer valid.' : pass.status === 'ENDED' ? 'This Scene has ended. Keep the memory; find your next plan.' : 'Your place is confirmed. Show this reservation to the organiser and follow their entry instructions.'}</p>{event.instructions && <p className="description">{event.instructions}</p>}{pass.status === 'CONFIRMED' && <div className="pass-actions">{event.startsAt && event.endsAtDate && <button className="button green" onClick={() => downloadCalendar(event, notify)}><Download size={16} />ADD TO CALENDAR</button>}<DirectionsLink scene={event} /></div>}</>}</section></div>
}

export function PlansPage({ user, going, saved, requested, hosted, loading, error, onRetry, onSelect, onPass, onExplore, Card }) {
  const [section, setSection] = useState('upcoming')
  const attending = going.filter((scene) => scene.host !== user.username)
  const past = (scene) => ['ENDED', 'CANCELLED'].includes(scene.eventStatus)
  const upcoming = attending.filter((scene) => !past(scene))
  const pending = requested.filter((scene) => !past(scene))
  const tabs = [{ id: 'upcoming', label: 'UPCOMING', count: upcoming.length }, { id: 'saved', label: 'SAVED', count: saved.length }, { id: 'requests', label: 'REQUESTS', count: pending.length }, { id: 'past', label: 'PAST', count: attending.filter(past).length }]
  const items = section === 'saved' ? saved : section === 'requests' ? pending : section === 'past' ? attending.filter(past) : upcoming
  const empty = { upcoming: ['Your next plan is out there.', 'Explore your city and reserve a spot. Your confirmed passes will appear here.'], saved: ['Keep a little inspiration.', 'Tap the bookmark on any event to save it here. Saving does not reserve a place.'], requests: ['No pending requests.', 'Scenes that require organiser approval will appear here while you wait.'], past: ['The memories start here.', 'Your completed and cancelled plans will appear here.'] }
  return <section className="page plans-page"><p className="eyebrow"><i />LESS FOMO. MORE MEMORIES.</p><h1>YOUR <span>PLANS.</span></h1><p className="intro">Your reservations, saved finds, and next good time. All together.</p><div className="plans-summary"><span><Ticket size={20} /><b>{upcoming.length}</b><small>UPCOMING PLANS</small></span><span><Bookmark size={20} /><b>{saved.length}</b><small>SAVED FOR LATER</small></span><span><Heart size={20} /><b>{attending.filter((scene) => scene.eventStatus === 'ENDED').length}</b><small>MEMORIES MADE</small></span></div><div className="plans-tabs" role="tablist" aria-label="Your plans">{tabs.map((item) => <button key={item.id} id={'plans-tab-' + item.id} role="tab" aria-selected={section === item.id} aria-controls="plans-results" className={section === item.id ? 'selected' : ''} onClick={() => setSection(item.id)}>{item.label}<span>{item.count}</span></button>)}</div><div id="plans-results" role="tabpanel" aria-labelledby={'plans-tab-' + section}>{error ? <div className="empty-state"><h3>Could not load your plans.</h3><p>{error}</p><button className="button green" onClick={onRetry}>TRY AGAIN</button></div> : loading ? <p className="loading-note" role="status">Loading your plans...</p> : items.length ? <div className="plan-list">{items.map((scene) => <div className="plan-item" key={scene.id}><Card scene={scene} onClick={() => onSelect(scene)} /><div className="plan-footer"><span>{section === 'saved' ? 'SAVED FOR LATER' : section === 'requests' ? 'AWAITING ORGANISER APPROVAL' : scene.eventStatus === 'CANCELLED' ? 'CANCELLED' : scene.eventStatus === 'ENDED' ? 'COMPLETED' : '1 PERSON · CONFIRMED'}<small>{scene.date} · {scene.city}</small></span>{section === 'saved' || section === 'requests' ? <button onClick={() => onSelect(scene)}>VIEW EVENT <ArrowRight size={15} /></button> : <button onClick={() => onPass(scene)}><Ticket size={16} />VIEW PASS</button>}</div></div>)}</div> : <div className="empty-state"><Bookmark size={30} /><h3>{empty[section][0]}</h3><p>{empty[section][1]}</p><button className="button green" onClick={() => onExplore({})}>EXPLORE YOUR CITY <ArrowRight size={16} /></button></div>}</div>{hosted.length > 0 && <div className="host-insights"><div><p className="eyebrow"><i />YOUR ORGANISER DESK</p><h2>MAKE IT <span>HAPPEN.</span></h2></div><div className="host-stats"><span><b>{hosted.filter((scene) => scene.publication !== 'draft' && !past(scene)).length}</b>ACTIVE SCENES</span><span><b>{hosted.filter((scene) => !past(scene)).reduce((sum, scene) => sum + Math.max(0, scene.joined - 1), 0)}</b>CONFIRMED GUESTS</span><span><b>{hosted.filter((scene) => !past(scene)).reduce((sum, scene) => sum + (scene.pendingRequests || 0), 0)}</b>PENDING REQUESTS</span></div><div className="host-event-list">{hosted.map((scene) => <button key={scene.id} onClick={() => onSelect(scene)}><span><b>{scene.title}</b><small>{scene.publication === 'draft' ? 'DRAFT' : scene.eventStatus} · {Math.max(0, scene.joined - 1)} guests{scene.pendingRequests > 0 ? ` · ${scene.pendingRequests} requests` : ''}</small></span><ArrowRight size={17} /></button>)}</div></div>}</section>
}
