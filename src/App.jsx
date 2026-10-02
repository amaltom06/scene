import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, Compass, LogIn, MapPin, MessageCircle, Plus, Search, Send, Users, X } from 'lucide-react'
import './App.css'

const photos = {
  football: 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1200&q=85',
  food: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
  movie: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=85',
  coffee: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85',
}
const jsonHeaders = { 'Content-Type': 'application/json' }
const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const apiFetch = (path, options) => fetch(`${apiBase}${path}`, { credentials: 'include', ...options })
const normalise = (scene) => ({ ...scene, id: scene.id || scene._id })
const isApiScene = (id) => /^[a-f\d]{24}$/i.test(id)
const categoryImage = (category) => category === 'Food' ? photos.food : category === 'Movies' ? photos.movie : category === 'Coffee' ? photos.coffee : photos.football

function App() {
  const [tab, setTab] = useState('home')
  const [scenes, setScenes] = useState([])
  const [selected, setSelected] = useState(null)
  const [chat, setChat] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [notice, setNotice] = useState('')

  const announce = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 2800) }
  useEffect(() => {
    apiFetch('/api/scenes').then((response) => response.ok ? response.json() : []).then((data) => {
      if (Array.isArray(data) && data.length) setScenes((current) => [...data.map(normalise), ...current])
    }).catch(() => undefined)
  }, [])
  useEffect(() => { apiFetch('/api/auth/me').then((response) => response.json()).then((data) => setUser(data.user)).catch(() => undefined) }, [])
  const visibleScenes = useMemo(() => scenes.filter((scene) => {
    const matchesText = `${scene.title} ${scene.area} ${scene.category}`.toLowerCase().includes(search.toLowerCase())
    return matchesText && (filter === 'All' || scene.category === filter)
  }), [scenes, search, filter])
  const joinScene = async (scene) => {
    if (!user) { setAuthOpen(true); announce('Sign in to join a scene.'); return }
    let joined = scene.joinType === 'open'
    if (isApiScene(scene.id)) {
      try {
        const response = await apiFetch(`/api/scenes/${scene.id}/join`, { method: 'POST', headers: jsonHeaders })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        joined = data.status === 'JOINED'
        if (data.scene) setScenes((current) => current.map((item) => item.id === scene.id ? normalise(data.scene) : item))
      } catch (error) { announce(error.message || 'Could not send the request.'); return }
    } else if (joined) setScenes((current) => current.map((item) => item.id === scene.id ? { ...item, joined: Math.min(item.joined + 1, item.capacity), members: [...item.members, 'Amal'] } : item))
    setSelected(null); announce(joined ? 'You’re in. The chat is unlocked.' : 'Request sent to the host.')
    if (joined) setChat(scene)
  }
  const createScene = async (draft) => {
    if (!user) { setCreateOpen(false); setAuthOpen(true); announce('Sign in to create a scene.'); return }
    const temporary = { ...draft, id: crypto.randomUUID(), host: user.username, joined: 1, members: [user.username], status: 'open', image: categoryImage(draft.category) }
    setScenes((current) => [temporary, ...current]); setCreateOpen(false); setTab('discover'); announce('Your scene is live.')
    try {
      const response = await apiFetch('/api/scenes', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(temporary) })
      if (!response.ok) return
      const saved = normalise(await response.json())
      setScenes((current) => current.map((scene) => scene.id === temporary.id ? saved : scene))
    } catch { /* The optimistic card still lets local/demo mode work. */ }
  }
  return <div className="app">
    <header className="nav"><button className="logo" onClick={() => { setTab('home'); setChat(null) }}>SCENE<span>.</span></button><nav><button className={tab === 'home' ? 'active' : ''} onClick={() => { setTab('home'); setChat(null) }}>HOME</button><button className={tab === 'discover' ? 'active' : ''} onClick={() => { setTab('discover'); setChat(null) }}>DISCOVER</button><button onClick={() => setCreateOpen(true)} className="nav-create"><Plus size={15} /> CREATE</button></nav>{user ? <div className="profile-dot" aria-label={`${user.username} profile`}>{user.username.slice(0, 2).toUpperCase()}</div> : <button className="sign-in" onClick={() => setAuthOpen(true)}><LogIn size={15} /> SIGN IN</button>}</header>
    <main>{chat ? <Chat scene={chat} user={user} onBack={() => setChat(null)} announce={announce} onSignIn={() => setAuthOpen(true)} /> : tab === 'home' ? <Home scenes={scenes} onExplore={() => setTab('discover')} onSelect={setSelected} onCreate={() => setCreateOpen(true)} /> : <Discover scenes={visibleScenes} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onSelect={setSelected} />}</main>
    <footer><span>SCENE / KOCHI</span><span>FIND THE PEOPLE. MAKE THE NIGHT.</span><span>© 2026</span></footer>
    {selected && <SceneDialog scene={selected} user={user} onClose={() => setSelected(null)} onJoin={() => joinScene(selected)} onChat={() => { setChat(selected); setSelected(null) }} />}
    {createOpen && <CreateDialog onClose={() => setCreateOpen(false)} onCreate={createScene} />}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuthenticated={(nextUser) => { setUser(nextUser); setAuthOpen(false); announce(`Welcome to SCENE, ${nextUser.username}.`) }} />}
    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </div>
}

function Home({ scenes, onExplore, onSelect, onCreate }) {
  return <><section className="hero"><div className="hero-image" /><div className="hero-copy"><p className="kicker"><i />KOCHI AFTER HOURS</p><h1>MAKE A<br /><em>SCENE.</em></h1><p className="hero-text">Plans that feel less like networking and more like a good story.</p><button className="button red" onClick={onExplore}>FIND YOUR NIGHT <ArrowRight size={17} /></button></div><div className="hero-card"><span>TONIGHT</span><b>07</b><small>OCT / FRI</small></div></section>
  <section className="content"><div className="section-title"><div><p className="kicker green"><i />LIVE NEAR YOU</p><h2>WHAT'S <span>ON.</span></h2></div><button className="quiet-button" onClick={onExplore}>VIEW ALL <ChevronRight size={16} /></button></div>{scenes.length ? <div className="scene-grid">{scenes.slice(0, 3).map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <EmptyState onCreate={onCreate} />}<section className="callout"><div><p className="kicker">DON'T WAIT FOR THE GROUP CHAT</p><h2>BE THE <span>PLAN.</span></h2><p>Put something good in motion.</p></div><button className="button ghost" onClick={onCreate}>CREATE A SCENE <Plus size={16} /></button></section></section></>
}

function Discover({ scenes, search, setSearch, filter, setFilter, onSelect }) {
  const categories = ['All', 'Football', 'Food', 'Movies', 'Coffee']
  return <section className="content discover"><p className="kicker green"><i />YOUR CITY, YOUR PEOPLE</p><h1>FIND YOUR <span>THING.</span></h1><p className="lead">Good people. Nearby plans. Zero awkward intros.</p><label className="search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scenes, areas, or vibes" /></label><div className="filters">{categories.map((category) => <button key={category} onClick={() => setFilter(category)} className={filter === category ? 'selected' : ''}>{category}</button>)}</div><div className="results"><span>{scenes.length} SCENES AVAILABLE</span><span><MapPin size={14} /> KOCHI, KERALA</span></div>{scenes.length ? <div className="scene-grid full">{scenes.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <EmptyState />}</section>
}

function EmptyState({ onCreate }) {
  return <div className="empty"><Compass size={30} /><h2>The city is waiting.</h2><p>There are no scenes yet. Be the first person to make a plan.</p>{onCreate && <button className="button red" onClick={onCreate}>CREATE THE FIRST SCENE <Plus size={16} /></button>}</div>
}

function SceneCard({ scene, onClick }) {
  return <button className="scene-card" onClick={onClick}><div className="scene-image" style={{ backgroundImage: `url(${scene.image || photos.football})` }}><span className="tag">{scene.category}</span><span className="time"><Clock3 size={13} />{scene.date} · {scene.time}</span></div><div className="card-body"><div><p className="card-area"><MapPin size={13} />{scene.area}</p><h3>{scene.title}</h3></div><ArrowRight className="card-arrow" size={19} /><div className="card-meta"><span><Users size={14} />{scene.joined}/{scene.capacity} going</span><b>{scene.price ? `₹${scene.price}` : 'FREE'}</b></div><div className="meter"><i style={{ width: `${Math.min(100, scene.joined / scene.capacity * 100)}%` }} /></div></div></button>
}

function SceneDialog({ scene, user, onClose, onJoin, onChat }) {
  const alreadyJoined = user && scene.members?.includes(user.username)
  return <div className="overlay" onMouseDown={onClose}><section className="modal scene-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close"><X /></button><div className="modal-image" style={{ backgroundImage: `url(${scene.image || photos.football})` }}><span className="tag">{scene.category}</span></div><div className="modal-body"><p className="kicker green"><i />{scene.area}</p><h2>{scene.title}</h2><p className="description">{scene.description}</p><div className="facts"><span><CalendarDays />{scene.date}</span><span><Clock3 />{scene.time} – {scene.endsAt}</span><span><MapPin />{scene.venue}</span></div><div className="host"><div className="avatar">{scene.host.slice(0, 2).toUpperCase()}</div><div><small>HOSTED BY</small><b>{scene.host}</b></div><span>{scene.joined}/{scene.capacity} GOING</span></div>{alreadyJoined ? <button className="button green-button wide" onClick={onChat}><MessageCircle size={17} /> OPEN GROUP CHAT</button> : <button className="button red wide" onClick={onJoin}>{scene.joinType === 'open' ? 'JOIN THIS SCENE' : 'REQUEST TO JOIN'} <ArrowRight size={17} /></button>}</div></section></div>
}

function CreateDialog({ onClose, onCreate }) {
  const [draft, setDraft] = useState({ title: '', category: 'Football', area: '', venue: '', date: 'Tonight', time: '7:30 PM', endsAt: '9:00 PM', capacity: 6, price: 0, description: '', joinType: 'approval' })
  const update = (event) => setDraft({ ...draft, [event.target.name]: event.target.value })
  const submit = (event) => { event.preventDefault(); onCreate({ ...draft, capacity: Number(draft.capacity), price: Number(draft.price) }) }
  return <div className="overlay" onMouseDown={onClose}><section className="modal create-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close"><X /></button><p className="kicker green"><i />START SOMETHING</p><h2>CREATE A <span>SCENE.</span></h2><form onSubmit={submit}><label>THE PLAN<input required name="title" value={draft.title} onChange={update} placeholder="Sunday kickabout, anyone?" maxLength="80" /></label><div className="two"><label>CATEGORY<select name="category" value={draft.category} onChange={update}>{['Football', 'Food', 'Movies', 'Coffee', 'Badminton', 'Gaming'].map((item) => <option key={item}>{item}</option>)}</select></label><label>WHEN<select name="date" value={draft.date} onChange={update}><option>Tonight</option><option>Tomorrow</option><option>Weekend</option></select></label></div><div className="two"><label>AREA<input required name="area" value={draft.area} onChange={update} placeholder="Kakkanad" /></label><label>TIME<input required name="time" value={draft.time} onChange={update} /></label></div><label>VENUE<input required name="venue" value={draft.venue} onChange={update} placeholder="Where should people meet?" /></label><div className="two"><label>PEOPLE<input required type="number" name="capacity" min="2" max="30" value={draft.capacity} onChange={update} /></label><label>PRICE (₹)<input required type="number" name="price" min="0" value={draft.price} onChange={update} /></label></div><label>THE VIBE<textarea name="description" value={draft.description} onChange={update} placeholder="Who is this for? What makes it worth showing up?" maxLength="500" /></label><button className="button red wide" type="submit">PUT IT OUT THERE <ArrowRight size={17} /></button></form></section></div>
}

function Chat({ scene, user, onBack, announce, onSignIn }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  useEffect(() => { if (isApiScene(scene.id)) apiFetch(`/api/scenes/${scene.id}/messages`).then((response) => response.ok ? response.json() : []).then((data) => { if (data.length) setMessages(data) }).catch(() => undefined) }, [scene.id])
  const send = async (event) => { event.preventDefault(); if (!user) { onSignIn(); announce('Sign in to join the conversation.'); return }; const value = text.trim(); if (!value) return; const optimistic = { sender: user.username, text: value, createdAt: new Date().toISOString() }; setMessages((current) => [...current, optimistic]); setText(''); if (!isApiScene(scene.id)) return; try { const response = await apiFetch(`/api/scenes/${scene.id}/messages`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text: value }) }); if (!response.ok) throw new Error(); const saved = await response.json(); setMessages((current) => current.map((message) => message === optimistic ? saved : message)) } catch { announce('Message was not sent. Please try again.') } }
  return <section className="chat"><header className="chat-header"><button onClick={onBack}>← BACK</button><div><p className="kicker green"><i />GROUP CHAT</p><h2>{scene.title}</h2></div><span>{scene.joined} PEOPLE</span></header><div className="chat-info"><MapPin size={14} />{scene.area} · {scene.time}</div><div className="messages">{messages.map((message, index) => <div key={`${message.sender}-${index}`} className={message.sender === user?.username ? 'message mine' : 'message'}><div className="message-name">{message.sender}</div><p>{message.text}</p></div>)}</div><form className="composer" onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={user ? 'Say something good...' : 'Sign in to join the chat'} maxLength="2000" /><button aria-label="Send message"><Send size={18} /></button></form></section>
}

function AuthDialog({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const response = await apiFetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onAuthenticated(data.user) } catch (nextError) { setError(nextError.message || 'Could not sign you in.') } finally { setBusy(false) } }
  return <div className="overlay" onMouseDown={onClose}><section className="modal auth-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close"><X /></button><p className="kicker green"><i />YOUR SCENE STARTS HERE</p><h2>{mode === 'login' ? 'WELCOME BACK.' : 'JOIN SCENE.'}</h2><p className="auth-copy">{mode === 'login' ? 'Sign in to create plans, meet people and chat.' : 'Create your profile and put something good in motion.'}</p><form onSubmit={submit}>{mode === 'register' && <label>YOUR NAME<input required name="username" value={form.username} onChange={update} minLength="2" maxLength="30" placeholder="How people will know you" /></label>}<label>EMAIL<input required name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" /></label><label>PASSWORD<input required name="password" type="password" value={form.password} onChange={update} minLength="8" placeholder="At least 8 characters" /></label>{error && <p className="form-error">{error}</p>}<button className="button red wide" disabled={busy}>{busy ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'} <ArrowRight size={17} /></button></form><button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'NEW HERE? CREATE YOUR ACCOUNT' : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}</button></section></div>
}

export default App
