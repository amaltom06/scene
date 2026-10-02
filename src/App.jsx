import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bell, CalendarDays, Check, Clock3, Compass, Heart, Home, ImagePlus, LogIn, MapPin, MessageCircle, PartyPopper, Plus, Search, Send, Ticket, UserPlus, Users, UserRound, Utensils, X } from 'lucide-react'
import './App.css'

const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const apiFetch = (path, options) => fetch(apiBase + path, { credentials: 'include', ...options })
const jsonHeaders = { 'Content-Type': 'application/json' }
const categories = ['All', 'Dining', 'Party', 'Meeting', 'Sport', 'Music', 'Coffee', 'Other']
const cities = { Kochi: [9.9312, 76.2673], Bengaluru: [12.9716, 77.5946], Mumbai: [19.076, 72.8777], Hyderabad: [17.385, 78.4867], Delhi: [28.6139, 77.209] }
const sceneId = (id) => /^[a-f\d]{24}$/i.test(id)
const tidy = (scene) => ({ ...scene, id: scene.id || scene._id, members: scene.members || [] })

function App() {
  const [tab, setTab] = useState('home')
  const [city, setCity] = useState('Kochi')
  const [scenes, setScenes] = useState([])
  const [posts, setPosts] = useState([])
  const [user, setUser] = useState(null)
  const [selected, setSelected] = useState(null)
  const [chat, setChat] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [momentOpen, setMomentOpen] = useState(false)

  const notify = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000) }
  useEffect(() => { apiFetch('/api/scenes?city=' + encodeURIComponent(city)).then((response) => response.ok ? response.json() : []).then((data) => setScenes(Array.isArray(data) ? data.map(tidy) : [])).catch(() => setScenes([])) }, [city])
  useEffect(() => { apiFetch('/api/posts?city=' + encodeURIComponent(city)).then((response) => response.ok ? response.json() : []).then((data) => setPosts(Array.isArray(data) ? data : [])).catch(() => setPosts([])) }, [city])
  useEffect(() => { apiFetch('/api/auth/me').then((response) => response.json()).then((data) => setUser(data.user)).catch(() => undefined) }, [])
  const move = (next) => { setTab(next); setChat(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const join = async (scene) => {
    if (!user) { setAuthOpen(true); notify('Sign in to reserve a place.'); return }
    if (!sceneId(scene.id)) return
    try {
      const response = await apiFetch('/api/scenes/' + scene.id + '/join', { method: 'POST', headers: jsonHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (data.scene) setScenes((current) => current.map((item) => item.id === scene.id ? tidy(data.scene) : item))
      setSelected(null)
      if (data.status === 'JOINED') { notify(scene.paymentRequired ? 'Place reserved. Payment follows confirmation.' : 'You are on the list.'); setChat(data.scene ? tidy(data.scene) : scene) } else notify('Request sent to the organiser.')
    } catch (error) { notify(error.message || 'Could not reserve a place.') }
  }
  const book = async (scene, quantity) => {
    if (!user) { setAuthOpen(true); notify('Sign in to book tickets.'); return }
    try {
      const response = await apiFetch('/api/scenes/' + scene.id + '/book', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ quantity, ticketName: 'General admission' }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setScenes((current) => current.map((item) => item.id === scene.id ? tidy(data.scene) : item))
      setSelected(null); notify(data.booking.paymentStatus === 'PENDING_PAYMENT' ? 'Ticket reserved. Payment confirmation is next.' : 'Your ticket is booked.')
    } catch (error) { notify(error.message || 'Could not book tickets.') }
  }
  const create = async (draft) => {
    if (!user) { setCreateOpen(false); setAuthOpen(true); notify('Sign in to publish a scene.'); return }
    try {
      const response = await apiFetch('/api/scenes', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(draft) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setScenes((current) => [tidy(data), ...current]); setCreateOpen(false); move('home'); notify('Your scene is live.')
    } catch (error) { notify(error.message || 'Could not publish this scene.') }
  }
  const createMoment = async (draft) => {
    if (!user) { setMomentOpen(false); setAuthOpen(true); notify('Sign in to share a moment.'); return }
    try {
      const response = await apiFetch('/api/posts', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ ...draft, city }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error)
      setPosts((current) => [data, ...current]); setMomentOpen(false); notify('Your moment is live.')
    } catch (error) { notify(error.message || 'Could not share this moment.') }
  }
  const likeMoment = async (post) => {
    if (!user) { setAuthOpen(true); notify('Sign in to like moments.'); return }
    try { const response = await apiFetch('/api/posts/' + post._id + '/like', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPosts((current) => current.map((item) => item._id === data._id ? data : item)) } catch (error) { notify(error.message || 'Could not like this moment.') }
  }
  const booked = useMemo(() => user ? scenes.filter((scene) => scene.members.includes(user.username)) : [], [scenes, user])
  const hosted = useMemo(() => user ? scenes.filter((scene) => scene.host === user.username) : [], [scenes, user])

  return <div className="app-shell">
    <header className="topbar"><button className="logo" onClick={() => move('home')}>SCENE<span>.</span></button><select className="city-picker" value={city} onChange={(event) => setCity(event.target.value)} aria-label="Choose city">{Object.keys(cities).map((name) => <option key={name}>{name}</option>)}</select><div className="top-actions"><button className="top-icon" onClick={() => notify('You are all caught up.')} aria-label="Notifications"><Bell size={19} /></button>{user ? <button className="user-chip" onClick={() => move('profile')}>{user.avatar ? <img src={user.avatar} alt="" /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}<b>{user.username}</b></button> : <button className="sign-in" onClick={() => setAuthOpen(true)}><LogIn size={16} />SIGN IN</button>}</div></header>
    <main>{chat ? <Chat scene={chat} user={user} onBack={() => setChat(null)} onSignIn={() => setAuthOpen(true)} notify={notify} /> : tab === 'home' ? <HomePage city={city} scenes={scenes} onDiscover={() => move('discover')} onCreate={() => setCreateOpen(true)} onSelect={setSelected} /> : tab === 'discover' ? <DiscoverPage city={city} scenes={scenes} posts={posts} user={user} onSelect={setSelected} onCreateMoment={() => setMomentOpen(true)} onLike={likeMoment} onSignIn={() => setAuthOpen(true)} notify={notify} /> : tab === 'map' ? <MapPage city={city} scenes={scenes} onSelect={setSelected} /> : <ProfilePage user={user} hosted={hosted} booked={booked} onSelect={setSelected} onSignIn={() => setAuthOpen(true)} />}</main>
    <Nav tab={tab} onMove={move} onCreate={() => setCreateOpen(true)} />
    {selected && <SceneDialog scene={selected} user={user} onClose={() => setSelected(null)} onJoin={() => join(selected)} onBook={(quantity) => book(selected, quantity)} onChat={() => { setChat(selected); setSelected(null) }} />}
    {createOpen && <CreateDialog city={city} onClose={() => setCreateOpen(false)} onCreate={create} />}
    {momentOpen && <MomentDialog onClose={() => setMomentOpen(false)} onCreate={createMoment} />}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuthenticated={(nextUser) => { setUser(nextUser); setAuthOpen(false); notify('Welcome to SCENE, ' + nextUser.username + '.') }} />}
    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </div>
}

function Nav({ tab, onMove, onCreate }) {
  const item = (name, icon, label) => <button className={tab === name ? 'nav-item active' : 'nav-item'} onClick={() => onMove(name)}>{icon}<span>{label}</span></button>
  return <nav className="bottom-nav">{item('home', <Home />, 'Home')}{item('discover', <Compass />, 'Discover')}<button className="create-nav" onClick={onCreate}><Plus /></button>{item('map', <MapPin />, 'Map')}{item('profile', <UserRound />, 'Profile')}</nav>
}

function HomePage({ city, scenes, onDiscover, onCreate, onSelect }) {
  const dining = scenes.filter((scene) => scene.category === 'Dining').slice(0, 5)
  return <><section className="live-hero"><div className="orb one" /><div className="orb two" /><div className="orb three" /><div className="hero-grid" /><div className="hero-content"><p className="eyebrow"><i />LIVE IN {city.toUpperCase()}</p><h1>YOUR NEXT<br /><span>GOOD STORY.</span></h1><p>Find people, tables, plans and places that feel like your kind of night.</p><div className="hero-buttons"><button className="button red" onClick={onDiscover}>EXPLORE NEARBY <ArrowRight size={17} /></button><button className="text-action" onClick={onCreate}>HOST SOMETHING <Plus size={16} /></button></div></div><div className="live-counter"><span><i />LIVE NOW</span><b>{scenes.length}</b><small>SCENES IN {city.toUpperCase()}</small></div></section>
  <section className="page"><SectionTitle eyebrow="YOUR CITY IS MOVING" title={scenes.length ? 'HAPPENING NOW.' : 'START THE PULSE.'} action="SEE EVERYTHING" onAction={onDiscover} />{scenes.length ? <div className="scene-rail">{scenes.slice(0, 6).map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="No scenes yet." text="Be the first to create a party, dinner, meeting or whatever your city needs." onCreate={onCreate} />}</section>
  <section className="page dark-break"><SectionTitle eyebrow="HUNGRY? SOCIALIZE OVER FOOD." title="TABLES & PEOPLE." action="FIND DINING" onAction={onDiscover} />{dining.length ? <div className="scene-rail">{dining.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <div className="dining-empty"><Utensils /><div><b>No dining scenes yet.</b><span>Host a meal and see who wants a seat at your table.</span></div><button className="button green" onClick={onCreate}>HOST A MEAL</button></div>}</section></>
}

function SectionTitle({ eyebrow, title, action, onAction }) { return <div className="section-heading"><div><p className="eyebrow"><i />{eyebrow}</p><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ArrowRight size={15} /></button>}</div> }

function DiscoverPage({ city, scenes, posts, user, onSelect, onCreateMoment, onLike, onSignIn, notify }) {
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('All'); const [mode, setMode] = useState('moments'); const [people, setPeople] = useState([])
  useEffect(() => { if (user) apiFetch('/api/people').then((response) => response.ok ? response.json() : []).then(setPeople).catch(() => setPeople([])) }, [user])
  const addFriend = async (name) => { if (!user) { onSignIn(); return }; try { const response = await apiFetch('/api/friends/request', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ recipient: name }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); notify(data.status === 'ACCEPTED' ? 'You are now friends.' : 'Friend request sent.'); setPeople((current) => current.filter((person) => person.username !== name)) } catch (error) { notify(error.message || 'Could not send request.') } }
  const results = scenes.filter((scene) => (filter === 'All' || scene.category === filter) && (scene.title + ' ' + scene.category + ' ' + scene.area + ' ' + scene.venue).toLowerCase().includes(search.toLowerCase()))
  return <section className="page discover-page"><p className="eyebrow"><i />DISCOVER {city.toUpperCase()}</p><h1>FIND YOUR<br /><span>PEOPLE.</span></h1><p className="intro">Moments from nights out, people with your energy, and events worth showing up for.</p><div className="discover-switch"><button className={mode === 'moments' ? 'selected' : ''} onClick={() => setMode('moments')}>MOMENTS</button><button className={mode === 'events' ? 'selected' : ''} onClick={() => setMode('events')}>EVENTS</button><button className={mode === 'people' ? 'selected' : ''} onClick={() => setMode('people')}>PEOPLE</button></div>{mode === 'moments' ? <><button className="share-moment" onClick={onCreateMoment}><ImagePlus size={17} /><span>POST A NIGHT OUT</span><ArrowRight size={16} /></button>{posts.length ? <div className="moment-grid">{posts.map((post) => <MomentCard key={post._id} post={post} user={user} onLike={() => onLike(post)} />)}</div> : <Empty title="No moments yet." text="Share a photo or video from an event and make the city feel alive." onCreate={onCreateMoment} />}</> : mode === 'people' ? user ? <PeopleList people={people} onAdd={addFriend} /> : <Empty title="Find your people." text="Sign in to discover people and send friend requests." onCreate={onSignIn} /> : <><label className="search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food, parties, people or places" /></label><div className="category-scroll">{categories.map((category) => <button key={category} className={filter === category ? 'selected' : ''} onClick={() => setFilter(category)}>{category === 'Dining' && <Utensils size={14} />}{category === 'Party' && <PartyPopper size={14} />}{category}</button>)}</div><div className="results-row"><span>{results.length} SCENES</span><span><MapPin size={14} />NEAR YOU</span></div>{results.length ? <div className="scene-list">{results.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="No results here yet." text="Try another category—or be the one who creates it." />}</>}</section>
}

function MomentCard({ post, user, onLike }) { const liked = user && post.likes.includes(user.username); return <article className="moment-card"><div className="moment-author"><div>{post.author.slice(0, 2).toUpperCase()}</div><span><b>{post.author}</b><small>{post.eventTitle || 'NIGHT OUT'} · {post.city}</small></span></div><div className="moment-media">{post.mediaType === 'video' ? <video src={post.mediaUrl} controls playsInline preload="metadata" /> : <img src={post.mediaUrl} alt={post.caption || 'Event moment'} />}</div><div className="moment-footer"><button className={liked ? 'liked' : ''} onClick={onLike}><Heart size={18} fill={liked ? 'currentColor' : 'none'} />{post.likes.length}</button>{post.caption && <p>{post.caption}</p>}</div></article> }

function PeopleList({ people, onAdd }) { return people.length ? <div className="people-list">{people.map((person) => <article key={person._id} className="person-row">{person.avatar ? <img src={person.avatar} alt="" /> : <span>{person.username.slice(0, 2).toUpperCase()}</span>}<div><b>{person.username}</b><small>Nightlife explorer</small></div><button onClick={() => onAdd(person.username)}><UserPlus size={16} />ADD</button></article>)}</div> : <Empty title="No new people nearby yet." text="As people create accounts in this city, you will be able to add them here." /> }

function MapPage({ city, scenes, onSelect }) {
  return <section className="map-page"><div className="real-map"><LiveMap city={city} scenes={scenes} onSelect={onSelect} /></div><section className="map-sheet"><div className="grabber" /><SectionTitle eyebrow={'LIVE IN ' + city.toUpperCase()} title="NEARBY PLANS." />{scenes.length ? <div className="scene-list compact">{scenes.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="Your map is clear." text="New scenes will appear here as your community starts hosting." />}</section></section>
}

function LiveMap({ city, scenes, onSelect }) {
  const mapElement = useRef(null); const mapRef = useRef(null); const markerLayer = useRef(null)
  useEffect(() => {
    const start = () => {
      if (!window.L || !mapElement.current) return
      if (!mapRef.current) { mapRef.current = window.L.map(mapElement.current, { zoomControl: false }); window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(mapRef.current); markerLayer.current = window.L.layerGroup().addTo(mapRef.current) }
      const fallback = cities[city] || cities.Kochi; mapRef.current.setView(fallback, 12); markerLayer.current.clearLayers()
      scenes.filter((scene) => Number.isFinite(scene.latitude) && Number.isFinite(scene.longitude)).forEach((scene) => {
        const marker = window.L.marker([scene.latitude, scene.longitude]).addTo(markerLayer.current)
        marker.bindPopup('<b>' + scene.title.replaceAll('<', '') + '</b><br>' + scene.joined + ' going')
        marker.on('click', () => onSelect(scene))
      })
      window.setTimeout(() => mapRef.current?.invalidateSize(), 0)
    }
    if (window.L) start(); else window.addEventListener('leaflet-library-loaded', start)
    return () => window.removeEventListener('leaflet-library-loaded', start)
  }, [city, scenes, onSelect])
  return <div className="leaflet-host" ref={mapElement}><div className="map-overlay"><p className="eyebrow"><i />REAL-TIME CITY MAP</p><b>{city}</b><span>Host locations appear after GPS capture.</span></div></div>
}

function ProfilePage({ user, hosted, booked, onSelect, onSignIn }) {
  if (!user) return <section className="profile-page"><div className="profile-cover"><div className="cover-orb" /></div><div className="profile-card signed-out"><div className="big-avatar"><UserRound /></div><p className="eyebrow"><i />YOUR CORNER OF SCENE</p><h1>MAKE IT<br /><span>YOURS.</span></h1><p>Build your profile, keep bookings together and meet people who like the same things.</p><button className="button red" onClick={onSignIn}>SIGN IN TO CONTINUE <LogIn size={17} /></button></div></section>
  return <section className="profile-page"><div className="profile-cover"><div className="cover-orb" /></div><div className="profile-card"><div className="profile-head">{user.avatar ? <img className="profile-avatar" src={user.avatar} alt="" /> : <div className="profile-avatar initials">{user.username.slice(0, 2).toUpperCase()}</div>}</div><h1>{user.username}</h1><p className="handle">@{user.username.toLowerCase().replaceAll(' ', '')} · Kochi</p><p className="bio">Here for good food, better people, and plans worth leaving the house for.</p><div className="profile-stats"><span><b>{hosted.length}</b>HOSTED</span><span><b>{booked.length}</b>BOOKED</span><span><b>{new Set(hosted.concat(booked).flatMap((scene) => scene.members)).size}</b>PEOPLE MET</span></div><div className="profile-tabs"><Ticket size={16} />YOUR BOOKINGS</div>{booked.length ? <div className="scene-list compact">{booked.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="Nothing booked yet." text="Reserve a place in a scene and it will live here." />}</div></section>
}

function SceneCard({ scene, onClick }) {
  const styles = { Dining: 'card-dining', Party: 'card-party', Meeting: 'card-meeting', Sport: 'card-sport', Music: 'card-music', Coffee: 'card-coffee' }
  return <button className={'scene-card ' + (styles[scene.category] || 'card-other')} onClick={onClick}><div className="scene-visual">{scene.image ? <img src={scene.image} alt="" /> : <><span className="visual-sun" /><span className="visual-line" /></>}<span className="scene-tag">{scene.category}</span><span className="scene-time"><Clock3 size={13} />{scene.date} · {scene.time}</span></div><div className="card-content"><p><MapPin size={13} />{scene.area}</p><h3>{scene.title}</h3><div><span className="attendees"><Users size={14} />{scene.joined}/{scene.capacity} people</span><b>{scene.paymentRequired || scene.price ? '₹' + (scene.price || 0) : 'FREE'}</b></div></div></button>
}

function Empty({ title, text, onCreate }) { return <div className="empty-state"><Compass size={31} /><h3>{title}</h3><p>{text}</p>{onCreate && <button className="button red" onClick={onCreate}>CREATE A SCENE <Plus size={16} /></button>}</div> }

function SceneDialog({ scene, user, onClose, onJoin, onBook, onChat }) {
  const [quantity, setQuantity] = useState(1)
  const joined = user && scene.members.includes(user.username)
  const ticketed = scene.paymentRequired || scene.price
  return <div className="overlay" onMouseDown={onClose}><section className="modal scene-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose}><X /></button><div className="modal-visual">{scene.image ? <img src={scene.image} alt="" /> : <div className="visual-sun" />}<span className="scene-tag">{scene.category}</span></div><div className="modal-content"><p className="eyebrow"><i />{scene.city || 'KOCHI'} · {scene.area}</p><h2>{scene.title}</h2>{scene.description && <p className="description">{scene.description}</p>}<div className="facts"><span><CalendarDays />{scene.date}</span><span><Clock3 />{scene.time}{scene.endsAt ? ' – ' + scene.endsAt : ''}</span><span><MapPin />{scene.venue}</span></div><div className="attendee-list"><div><span className="avatar-stack">{scene.members.slice(0, 4).map((member) => <i key={member}>{member.slice(0, 1)}</i>)}</span><b>{scene.joined} people are in</b><small>{scene.capacity - scene.joined} spots left</small></div><ul>{scene.members.slice(0, 5).map((member) => <li key={member}>{member}</li>)}</ul></div>{ticketed && <div className="ticket-box"><div><b>GENERAL ADMISSION</b><span>₹{scene.price || 0} per person</span></div><label>QUANTITY<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}</option>)}</select></label><strong>₹{(scene.price || 0) * quantity}</strong></div>}{ticketed ? <div className="payment-note"><b>BOOKING PROTECTED</b><span>Your ticket is reserved first; payment is confirmed by the organiser.</span></div> : null}{joined ? <button className="button green wide" onClick={onChat}><MessageCircle size={17} />OPEN GROUP CHAT</button> : ticketed ? <button className="button red wide" onClick={() => onBook(quantity)}>BOOK TICKETS <Ticket size={17} /></button> : <button className="button red wide" onClick={onJoin}>JOIN THIS SCENE<ArrowRight size={17} /></button>}</div></section></div>
}

function CreateDialog({ city, onClose, onCreate }) {
  const [draft, setDraft] = useState({ title: '', category: 'Dining', city, area: '', venue: '', date: '', time: '', capacity: 10, price: 0, paymentRequired: false, description: '', image: '', latitude: '', longitude: '' })
  const [locationNote, setLocationNote] = useState('')
  const update = (event) => { const { name, value, type, checked } = event.target; setDraft({ ...draft, [name]: type === 'checkbox' ? checked : value }) }
  const captureLocation = () => { if (!navigator.geolocation) { setLocationNote('GPS is not available in this browser.'); return }; setLocationNote('Getting your location…'); navigator.geolocation.getCurrentPosition((position) => { setDraft({ ...draft, latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationNote('GPS location added to the map.') }, () => setLocationNote('Location was not shared. You can still publish without it.'), { enableHighAccuracy: true, timeout: 10000 }) }
  const submit = (event) => { event.preventDefault(); onCreate({ ...draft, capacity: Number(draft.capacity) || 10, price: Number(draft.price) || 0 }) }
  return <div className="overlay" onMouseDown={onClose}><section className="modal create-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose}><X /></button><p className="eyebrow"><i />PUBLISH A PLAN · {city.toUpperCase()}</p><h2>MAKE A<br /><span>SCENE.</span></h2><p className="form-note">Every field is optional. Start with as much or as little as you know.</p><form onSubmit={submit}><label>TITLE<input name="title" value={draft.title} onChange={update} placeholder="Club night, party, concert..." /></label><div className="two"><label>TYPE<select name="category" value={draft.category} onChange={update}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>PEOPLE<input type="number" name="capacity" min="2" max="1000" value={draft.capacity} onChange={update} /></label></div><div className="two"><label>AREA<input name="area" value={draft.area} onChange={update} placeholder="Neighbourhood" /></label><label>VENUE<input name="venue" value={draft.venue} onChange={update} placeholder="Club, pub or venue" /></label></div><button className="gps-button" type="button" onClick={captureLocation}><MapPin size={16} />USE MY GPS LOCATION</button>{locationNote && <small className="location-note">{locationNote}</small>}<div className="two"><label>DATE<input name="date" value={draft.date} onChange={update} placeholder="Tonight" /></label><label>TIME<input name="time" value={draft.time} onChange={update} placeholder="10:30 PM" /></label></div><label>IMAGE LINK<input name="image" type="url" value={draft.image} onChange={update} placeholder="Optional image URL" /></label><label>DESCRIPTION<textarea name="description" value={draft.description} onChange={update} placeholder="What should people know?" maxLength="500" /></label><div className="payment-setting"><label><input type="checkbox" name="paymentRequired" checked={draft.paymentRequired} onChange={update} />SELL TICKETS</label>{draft.paymentRequired && <label>PRICE ₹<input type="number" name="price" min="0" value={draft.price} onChange={update} /></label>}</div><button className="button red wide" type="submit">PUBLISH SCENE <ArrowRight size={17} /></button></form></section></div>
}

function MomentDialog({ onClose, onCreate }) {
  const [draft, setDraft] = useState({ eventTitle: '', mediaType: 'image', mediaUrl: '', caption: '' })
  const update = (event) => setDraft({ ...draft, [event.target.name]: event.target.value })
  return <div className="overlay" onMouseDown={onClose}><section className="modal moment-dialog" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose}><X /></button><p className="eyebrow"><i />AFTER DARK</p><h2>POST A<br /><span>MOMENT.</span></h2><p className="form-note">Share a photo or video URL from a party, event, pub or concert.</p><form onSubmit={(event) => { event.preventDefault(); onCreate(draft) }}><label>EVENT OR PLACE<input name="eventTitle" value={draft.eventTitle} onChange={update} placeholder="Saturday at the club" /></label><label>MEDIA TYPE<select name="mediaType" value={draft.mediaType} onChange={update}><option value="image">Photo</option><option value="video">Video</option></select></label><label>{draft.mediaType === 'video' ? 'VIDEO URL' : 'PHOTO URL'}<input name="mediaUrl" type="url" value={draft.mediaUrl} onChange={update} placeholder="https://..." required /></label><label>CAPTION<textarea name="caption" value={draft.caption} onChange={update} placeholder="How was the night?" maxLength="500" /></label><button className="button red wide">SHARE MOMENT <ArrowRight size={17} /></button></form></section></div>
}

function Chat({ scene, user, onBack, onSignIn, notify }) {
  const [messages, setMessages] = useState([]); const [text, setText] = useState('')
  useEffect(() => { if (sceneId(scene.id)) apiFetch('/api/scenes/' + scene.id + '/messages').then((response) => response.ok ? response.json() : []).then(setMessages).catch(() => undefined) }, [scene.id])
  const send = async (event) => { event.preventDefault(); if (!user) { onSignIn(); return }; if (!text.trim()) return; try { const response = await apiFetch('/api/scenes/' + scene.id + '/messages', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text }) }); const message = await response.json(); if (!response.ok) throw new Error(message.error); setMessages((current) => current.concat(message)); setText('') } catch (error) { notify(error.message || 'Message not sent.') } }
  return <section className="chat-page"><header className="chat-header"><button onClick={onBack}>← BACK</button><div><p className="eyebrow"><i />GROUP CHAT</p><h2>{scene.title}</h2></div></header><div className="messages">{messages.length ? messages.map((message) => <div key={message._id} className={message.sender === user?.username ? 'message mine' : 'message'}><b>{message.sender}</b><p>{message.text}</p></div>) : <Empty title="Start the conversation." text="Ask who is coming, coordinate a ride, or say hello." />}</div><form className="composer" onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={user ? 'Write a message...' : 'Sign in to chat'} maxLength="2000" /><button><Send size={18} /></button></form></section>
}

function AuthDialog({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login'); const [form, setForm] = useState({ username: '', email: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const response = await apiFetch('/api/auth/' + (mode === 'login' ? 'login' : 'register'), { method: 'POST', headers: jsonHeaders, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onAuthenticated(data.user) } catch (nextError) { setError(nextError.message || 'Could not sign you in.') } finally { setBusy(false) } }
  return <div className="overlay" onMouseDown={onClose}><section className="modal auth-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose}><X /></button><p className="eyebrow"><i />YOUR SCENE STARTS HERE</p><h2>{mode === 'login' ? 'WELCOME BACK.' : 'JOIN SCENE.'}</h2><GoogleSignIn onAuthenticated={onAuthenticated} onError={setError} /><div className="divider"><span />OR WITH EMAIL<span /></div><form onSubmit={submit}>{mode === 'register' && <label>YOUR NAME<input name="username" value={form.username} onChange={update} placeholder="How people know you" minLength="2" maxLength="30" /></label>}<label>EMAIL<input name="email" type="email" value={form.email} onChange={update} placeholder="you@gmail.com" required /></label><label>PASSWORD<input name="password" type="password" value={form.password} onChange={update} placeholder="At least 8 characters" minLength="8" required /></label>{error && <p className="form-error">{error}</p>}<button className="button red wide" disabled={busy}>{busy ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}<ArrowRight size={17} /></button></form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'NEW HERE? CREATE AN ACCOUNT' : 'ALREADY A MEMBER? SIGN IN'}</button></section></div>
}

function GoogleSignIn({ onAuthenticated, onError }) {
  const ref = useRef(null)
  useEffect(() => { if (!googleClientId) return; const render = () => { if (!window.google || !ref.current) return; window.google.accounts.id.initialize({ client_id: googleClientId, callback: async ({ credential }) => { try { const response = await apiFetch('/api/auth/google', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ credential }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onAuthenticated(data.user) } catch (error) { onError(error.message || 'Google sign-in failed.') } } }); window.google.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'large', width: 340, text: 'continue_with' }) }; if (window.google) render(); else window.addEventListener('google-library-loaded', render); return () => window.removeEventListener('google-library-loaded', render) }, [onAuthenticated, onError])
  return googleClientId ? <div className="google-button" ref={ref} /> : <p className="google-config">Add a Google client ID in .env to enable Gmail sign-in.</p>
}

export default App
