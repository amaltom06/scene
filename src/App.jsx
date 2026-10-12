import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, Compass, Heart, Home, ImagePlus, LogIn, MapPin, MessageCircle, PartyPopper, Plus, Search, Send, Share2, Ticket, UserPlus, Users, UserRound, Utensils, X } from 'lucide-react'
import { eventCategories } from '../shared/events.js'
import EventExplorer from './EventExplorer.jsx'
import EventImage from './EventImage.jsx'
import { CategoryBrowser, DirectionsLink, DiscoveryShortcuts, downloadCalendar, EventActionsContext, PassDialog, PlansPage, SaveSceneButton, shareScene, useDialogFocus } from './EventFeatures.jsx'
import './App.css'
import './responsive.css'

const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const apiFetch = (path, options) => fetch(apiBase + path, { credentials: 'include', ...options })
const avatarSrc = (avatar) => avatar?.startsWith('/api/avatars/') ? apiBase + avatar : avatar
const jsonHeaders = { 'Content-Type': 'application/json' }
const categories = ['All', ...eventCategories]
const cities = { Kochi: [9.9312, 76.2673], Thiruvananthapuram: [8.5241, 76.9366], Bengaluru: [12.9716, 77.5946], Mumbai: [19.076, 72.8777], Hyderabad: [17.385, 78.4867], Delhi: [28.6139, 77.209], Chennai: [13.0827, 80.2707], Pune: [18.5204, 73.8567], Kolkata: [22.5726, 88.3639] }
const sceneId = (id) => /^[a-f\d]{24}$/i.test(id)
const tidy = (scene) => ({ ...scene, id: scene.id || scene._id, members: scene.members || [] })

function App() {
  const [tab, setTab] = useState('home')
  const [city, setCity] = useState('Kochi')
  const [scenes, setScenes] = useState([])
  const [sceneTotal, setSceneTotal] = useState(0)
  const [myScenes, setMyScenes] = useState([])
  const [goingScenes, setGoingScenes] = useState([])
  const [savedScenes, setSavedScenes] = useState([])
  const [requestedScenes, setRequestedScenes] = useState([])
  const [personalLoading, setPersonalLoading] = useState(false)
  const [personalError, setPersonalError] = useState('')
  const [savingIds, setSavingIds] = useState([])
  const [passScene, setPassScene] = useState(null)
  const [exploreOptions, setExploreOptions] = useState({})
  const personalGeneration = useRef(0)
  const [sceneError, setSceneError] = useState('')
  const [scenesLoading, setScenesLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [selected, setSelected] = useState(null)
  const [chat, setChat] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(() => new URLSearchParams(window.location.search).has('reset'))
  const [notice, setNotice] = useState('')
  const [momentOpen, setMomentOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const notify = useCallback((message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000) }, [])
  useEffect(() => { const token = new URLSearchParams(window.location.search).get('verify'); if (!token) return; apiFetch('/api/auth/verify', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ token }) }).then((response) => response.json().then((data) => { if (!response.ok) throw new Error(data.error); notify('Your email is verified.'); apiFetch('/api/auth/me').then((result) => result.json()).then((data) => setUser(data.user)) })).catch((error) => notify(error.message || 'Verification failed.')); window.history.replaceState({}, '', window.location.pathname) }, [notify])
  const refreshScenes = useCallback(async () => { setScenesLoading(true); try { const response = await apiFetch('/api/scenes?city=' + encodeURIComponent(city)); const data = await response.json(); if (!response.ok) throw new Error(data.error); setScenes(Array.isArray(data) ? data.map(tidy) : []); setSceneTotal(Number(response.headers.get('X-Total')) || 0); setSceneError('') } catch (error) { setSceneError(error.message || 'Scenes could not be loaded.') } finally { setScenesLoading(false) } }, [city])
  const refreshPersonal = useCallback(async () => {
    if (!user) return
    const generation = ++personalGeneration.current
    setPersonalLoading(true)
    try {
      const [hosted, going, saved, requested] = await Promise.all(['mine', 'participating', 'saved', 'requested'].map(async (kind) => {
        const result = []
        for (let page = 1; ; page += 1) {
          const response = await apiFetch(`/api/scenes?${kind}=1&limit=50&page=${page}`)
          const data = await response.json()
          if (!response.ok) throw new Error(data.error)
          result.push(...data.map(tidy))
          if (response.headers.get('X-Has-More') !== '1') return result
        }
      }))
      if (generation !== personalGeneration.current) return
      setMyScenes(hosted); setGoingScenes(going); setSavedScenes(saved); setRequestedScenes(requested); setPersonalError('')
    } catch (error) { if (generation === personalGeneration.current) setPersonalError(error.message || 'Your plans could not be refreshed.') }
    finally { if (generation === personalGeneration.current) setPersonalLoading(false) }
  }, [user])
  useEffect(() => { if (!user) return; const task = window.setTimeout(refreshScenes, 0); return () => window.clearTimeout(task) }, [refreshScenes, user])
  useEffect(() => { if (!user) return; const timer = window.setInterval(refreshScenes, 60000); return () => window.clearInterval(timer) }, [refreshScenes, user])
  useEffect(() => { const task = window.setTimeout(refreshPersonal, 0); return () => window.clearTimeout(task) }, [refreshPersonal])
  useEffect(() => { if (!user) return; apiFetch('/api/posts?city=' + encodeURIComponent(city)).then((response) => response.ok ? response.json() : []).then((data) => setPosts(Array.isArray(data) ? data : [])).catch(() => setPosts([])) }, [city, user])
  useEffect(() => { apiFetch('/api/auth/me').then((response) => response.json()).then((data) => { if (!new URLSearchParams(window.location.search).has('reset')) { setUser(data.user); if (data.user?.city) setCity(data.user.city) } }).catch(() => undefined).finally(() => setAuthChecked(true)) }, [])
  useEffect(() => { if (!user) return; const id = new URLSearchParams(window.location.search).get('scene'); if (!id || !sceneId(id)) return; apiFetch('/api/scenes/' + id).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(tidy(data)) }).catch((error) => notify(error.message || 'Scene could not be opened.')) }, [notify, user])
  const move = (next) => { setTab(next); setChat(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const explore = (options = {}) => { setExploreOptions(options.nativeEvent ? {} : options); move('discover') }
  const openScene = async (scene) => {
    setSelected(scene)
    try {
      const response = await apiFetch('/api/scenes/' + scene.id)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSelected((current) => current?.id === scene.id ? tidy(data) : current)
    } catch (error) { notify(error.message || 'Scene could not be refreshed.') }
  }
  const saveScene = async (scene) => {
    if (savingIds.includes(scene.id)) return
    const saved = user.savedSceneIds?.includes(scene.id)
    setSavingIds((current) => [...current, scene.id])
    try {
      const response = await apiFetch('/api/scenes/' + scene.id + '/save', { method: saved ? 'DELETE' : 'PUT' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setUser((current) => current?.username === user.username ? { ...current, savedSceneIds: data.savedSceneIds } : current)
      notify(saved ? 'Removed from saved events.' : 'Saved. Find it in My plans.')
    } catch (error) { notify(error.message || 'Could not save this event.') }
    finally { setSavingIds((current) => current.filter((id) => id !== scene.id)) }
  }
  const join = async (scene) => {
    if (!user) { setAuthOpen(true); notify('Sign in to reserve a place.'); return }
    if (!sceneId(scene.id)) return
    try {
      const response = await apiFetch('/api/scenes/' + scene.id + '/join', { method: 'POST', headers: jsonHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (data.scene) setScenes((current) => current.map((item) => item.id === scene.id ? tidy(data.scene) : item))
      if (data.scene) setSelected(tidy(data.scene))
      refreshPersonal()
      notify(data.status === 'JOINED' ? 'Your place is confirmed. Your pass is ready.' : 'Request sent. Track organiser approval in My plans.')
    } catch (error) { notify(error.message || 'Could not reserve a place.') }
  }
  const create = async (draft) => {
    if (!user) { setCreateOpen(false); setAuthOpen(true); notify('Sign in to publish a scene.'); return }
    try {
      const response = await apiFetch('/api/scenes', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(draft) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (data.publication === 'published' && data.city === city && data.visibility === 'public') setScenes((current) => [tidy(data), ...current]); setCreateOpen(false); move('profile'); refreshScenes(); refreshPersonal(); notify(data.publication === 'draft' ? 'Draft saved.' : 'Your Scene is live.')
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
  const booked = useMemo(() => user ? goingScenes.filter((scene) => scene.host !== user.username) : [], [goingScenes, user])
  const hosted = myScenes
  const authenticated = (nextUser) => { setUser(nextUser); if (nextUser.city) setCity(nextUser.city); setAuthOpen(false); if (!nextUser.onboarded) setProfileOpen(true); notify('Welcome to SCENE, ' + nextUser.username + '.') }
  const logout = async () => {
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Could not log out. Please try again.')
      personalGeneration.current += 1
      setUser(null); setMyScenes([]); setGoingScenes([]); setSavedScenes([]); setRequestedScenes([]); setScenes([]); setPosts([]); setPassScene(null); setPersonalLoading(false)
      setSelected(null); setChat(null); setCreateOpen(false); setMomentOpen(false); setProfileOpen(false)
      move('home')
      notify('You have logged out.')
    } catch (error) { notify(error.message || 'Could not log out.') }
  }

  if (!authChecked) return <div className="auth-loading" role="status"><span className="logo">SCENE<span>.</span></span><p>OPENING YOUR SCENE...</p></div>
  if (!user) return <SignedOutScreen onAuthenticated={authenticated} notify={notify} notice={notice} />

  return <EventActionsContext.Provider value={{ savedIds: user.savedSceneIds || [], savingIds, onSave: saveScene }}><div className="app-shell">
    <header className="topbar"><button className="logo" onClick={() => move('home')}>SCENE<span>.</span></button><select className="city-picker" value={city} onChange={(event) => setCity(event.target.value)} aria-label="Choose city">{[...new Set([...Object.keys(cities), city])].map((name) => <option key={name}>{name}</option>)}</select><div className="top-actions"><button className={'plans-nav ' + (tab === 'plans' ? 'active' : '')} onClick={() => move('plans')} aria-label="My plans, saved events and passes"><Ticket size={18} /><span>MY PLANS</span></button><button className="user-chip" aria-label="Your profile" onClick={() => move('profile')}>{user.avatar ? <img src={avatarSrc(user.avatar)} alt="" /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}<b>{user.displayName || user.username}</b></button></div></header>
    {(user.isDemo || scenes.some((scene) => scene.isDemo)) && <div className="demo-banner"><span>DEMO COMMUNITY</span>Fictional people, sample events, real app interactions.</div>}
    <main className="app-main">{chat ? <Chat scene={chat} user={user} onBack={() => setChat(null)} onSignIn={() => setAuthOpen(true)} notify={notify} /> : tab === 'home' ? <HomePage city={city} user={user} scenes={scenes} total={sceneTotal} loading={scenesLoading} error={sceneError} onRetry={refreshScenes} onDiscover={explore} onPlans={() => move('plans')} onCreate={() => setCreateOpen(true)} onSelect={openScene} /> : tab === 'discover' ? <DiscoverPage key={JSON.stringify(exploreOptions)} initialFilters={exploreOptions} city={city} scenes={scenes} posts={posts} user={user} onSelect={openScene} onCreateMoment={() => setMomentOpen(true)} onLike={likeMoment} onSignIn={() => setAuthOpen(true)} notify={notify} /> : tab === 'plans' ? <PlansPage user={user} going={goingScenes} saved={savedScenes} requested={requestedScenes} hosted={hosted} loading={personalLoading} error={personalError} onRetry={refreshPersonal} onSelect={openScene} onPass={setPassScene} onExplore={explore} Card={SceneCard} /> : tab === 'chats' ? <ChatHub user={user} scenes={goingScenes} onOpen={setChat} onSignIn={() => setAuthOpen(true)} /> : <ProfilePage user={user} hosted={hosted} booked={booked} onPlans={() => move('plans')} onSelect={openScene} onSignIn={() => setAuthOpen(true)} onEdit={() => setProfileOpen(true)} onVerify={async () => { try { const response = await apiFetch('/api/auth/verification/request', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); notify(data.sent ? 'Verification email sent.' : data.message) } catch (error) { notify(error.message || 'Could not send verification email.') } }} onLogout={logout} />}</main>
    <Nav tab={tab} onMove={(next) => next === 'discover' ? explore() : move(next)} onCreate={() => setCreateOpen(true)} />
    {selected && <SceneDialog scene={selected} user={user} onClose={() => { setSelected(null); if (new URLSearchParams(window.location.search).has('scene')) window.history.replaceState({}, '', window.location.pathname) }} onJoin={() => join(selected)} onPass={() => { setPassScene(selected); setSelected(null) }} onChat={() => { setChat(selected); setSelected(null) }} onChanged={(nextScene) => { setSelected(tidy(nextScene)); refreshScenes(); refreshPersonal() }} notify={notify} />}
    {passScene && <PassDialog scene={passScene} onClose={() => setPassScene(null)} notify={notify} />}
    {createOpen && <CreateDialog city={city} onClose={() => setCreateOpen(false)} onCreate={create} onPost={() => { setCreateOpen(false); setMomentOpen(true) }} />}
    {momentOpen && <MomentDialog onClose={() => setMomentOpen(false)} onCreate={createMoment} />}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuthenticated={authenticated} notify={notify} />}
    {profileOpen && user && <ProfileDialog user={user} onClose={() => setProfileOpen(false)} onSaved={(nextUser) => { setUser(nextUser); if (nextUser.city) setCity(nextUser.city); setProfileOpen(false); notify('Profile saved.') }} notify={notify} />}
    {notice && <div className="toast"><Check size={17} />{notice}</div>}
  </div></EventActionsContext.Provider>
}

function SignedOutScreen({ onAuthenticated, notify, notice }) {
  return <div className="auth-gate">
    <header className="auth-gate-header"><span className="logo">SCENE<span>.</span></span><span className="auth-gate-label">YOUR CITY. YOUR PEOPLE.</span></header>
    <main className="auth-gate-main">
      <div className="auth-gate-visual" aria-hidden="true"><div className="auth-gate-orb" /><span className="auth-gate-mark">S<span>.</span></span><span className="auth-gate-stamp">REAL PLANS<br />REAL PEOPLE</span></div>
      <div className="auth-gate-content"><p className="eyebrow"><i />WELCOME TO SCENE</p><h1>FIND YOUR<br /><span>SCENE.</span></h1><p className="auth-gate-intro">Sign in to discover plans, share moments, and meet people nearby.</p><AuthDialog standalone onAuthenticated={onAuthenticated} notify={notify} /></div>
    </main>
    <footer className="auth-gate-footer">SCENE · GO OUT. FIND YOUR PEOPLE.</footer>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
  </div>
}

function Nav({ tab, onMove, onCreate }) {
  const item = (name, icon, label) => <button className={tab === name ? 'nav-item active' : 'nav-item'} aria-current={tab === name ? 'page' : undefined} onClick={() => onMove(name)}>{icon}<span>{label}</span></button>
  return <nav className="bottom-nav" aria-label="Main navigation">{item('home', <Home />, 'Home')}{item('discover', <Compass />, 'Explore')}<button className="create-nav" onClick={onCreate} aria-label="Create"><Plus /></button>{item('chats', <MessageCircle />, 'Chats')}{item('profile', <UserRound />, 'Profile')}</nav>
}

function HomePage({ city, user, scenes, total, loading, error, onRetry, onDiscover, onPlans, onCreate, onSelect }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  const upcoming = scenes.filter((scene) => !['ENDED', 'CANCELLED'].includes(scene.eventStatus))
  const food = upcoming.filter((scene) => ['Food Meetups', 'Dining', 'Coffee'].includes(scene.category)).slice(0, 5)
  const recommendations = upcoming.filter((scene) => user.interests?.includes(scene.category)).slice(0, 6)
  const sections = [
    { title: 'HAPPENING NOW.', eyebrow: 'OUT IN THE CITY', items: upcoming.filter((scene) => ['LIVE NOW', 'IN PROGRESS'].includes(scene.eventStatus)) },
    { title: 'TONIGHT.', eyebrow: 'AFTER DARK', items: upcoming.filter((scene) => { const date = new Date(scene.startsAt); return Number.isFinite(date.getTime()) && date.toDateString() === now.toDateString() && date.getHours() >= 17 }) },
    { title: 'THIS WEEKEND.', eyebrow: 'MAKE A PLAN', items: upcoming.filter((scene) => { const date = new Date(scene.startsAt); return Number.isFinite(date.getTime()) && date > now && date.getTime() - now.getTime() < 7 * 86400000 && [0, 6].includes(date.getDay()) }) },
    { title: 'SPONTANEOUS.', eyebrow: 'QUICK SCENES', items: upcoming.filter((scene) => scene.kind === 'quick') },
    { title: 'LIVE MUSIC.', eyebrow: 'CONCERTS & SOUNDS', items: upcoming.filter((scene) => ['Concerts', 'DJ Nights', 'Music'].includes(scene.category)) },
    { title: 'A LITTLE LAUGHTER.', eyebrow: 'COMEDY & OPEN MICS', items: upcoming.filter((scene) => scene.category === 'Comedy') },
    { title: 'TRY SOMETHING NEW.', eyebrow: 'WORKSHOPS & EXPERIENCES', items: upcoming.filter((scene) => ['Workshops', 'Experiences', 'Wellness'].includes(scene.category)) },
  ]
  return <><section className="live-hero"><div className="orb one" /><div className="orb two" /><div className="orb three" /><div className="hero-grid" /><div className="hero-content"><p className="eyebrow"><i />DISCOVER {city.toUpperCase()}</p><h1>STOP SCROLLING.<br /><span>START LIVING.</span></h1><p>Your city. Your people. Your plans. Find what is happening and make a story worth telling.</p><div className="hero-buttons"><button className="button green" onClick={onDiscover}>EXPLORE SCENES <ArrowRight size={17} /></button><button className="text-action" onClick={onCreate}>HOST SOMETHING <Plus size={16} /></button></div></div><div className="live-counter"><span><i />DISCOVER</span><b>{total}</b><small>SCENES IN {city.toUpperCase()}</small></div></section>
  <section className="page discovery-launch"><DiscoveryShortcuts onExplore={onDiscover} onPlans={onPlans} /><CategoryBrowser onExplore={onDiscover} /></section>
  {recommendations.length > 0 && <section className="page dark-break"><SectionTitle eyebrow="BASED ON YOUR INTERESTS" title="MORE YOUR THING." action="FOR YOU" onAction={() => onDiscover({ forYou: true })} /><div className="scene-rail">{recommendations.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div></section>}
  <section className="page"><SectionTitle eyebrow="YOUR CITY IS MOVING" title={upcoming.length ? 'FIND YOUR SCENE.' : 'START THE PULSE.'} action="SEE EVERYTHING" onAction={() => onDiscover({})} />{error ? <div className="empty-state"><h3>Could not load Scenes.</h3><p>{error}</p><button className="button green" onClick={onRetry}>TRY AGAIN</button></div> : loading ? <p className="loading-note">Loading local plans...</p> : upcoming.length ? <div className="scene-rail">{upcoming.slice(0, 6).map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="No scenes yet." text="Be the first to create a concert, meetup, game or whatever your city needs." onCreate={onCreate} />}</section>
  {sections.filter((section) => section.items.length).map((section) => <section className="page dark-break" key={section.title}><SectionTitle eyebrow={section.eyebrow} title={section.title} action="EXPLORE" onAction={onDiscover} /><div className="scene-rail">{section.items.slice(0, 5).map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div></section>)}
  <section className="page dark-break"><SectionTitle eyebrow="SHARE A TABLE" title="FOOD & PEOPLE." action="EXPLORE" onAction={onDiscover} />{food.length ? <div className="scene-rail">{food.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <div className="dining-empty"><Utensils /><div><b>No food Scenes yet.</b><span>Host a meal and see who wants a seat at your table.</span></div><button className="button green" onClick={onCreate}>HOST A MEAL</button></div>}</section></>
}

function SectionTitle({ eyebrow, title, action, onAction }) { return <div className="section-heading"><div><p className="eyebrow"><i />{eyebrow}</p><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ArrowRight size={15} /></button>}</div> }

function DiscoverPage({ city, scenes, posts, user, initialFilters = {}, onSelect, onCreateMoment, onLike, onSignIn, notify }) {
  const [mode, setMode] = useState(initialFilters.mode || 'events')
  const [people, setPeople] = useState([])
  useEffect(() => { if (user) apiFetch('/api/people').then((response) => response.ok ? response.json() : []).then(setPeople).catch(() => setPeople([])) }, [user])
  const addFriend = async (name) => {
    if (!user) { onSignIn(); return }
    try {
      const response = await apiFetch('/api/friends/request', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ recipient: name }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      notify(data.status === 'ACCEPTED' ? 'You are now friends.' : 'Friend request sent.')
      setPeople((current) => current.filter((person) => person.username !== name))
    } catch (error) { notify(error.message || 'Could not send request.') }
  }
  return <section className="page discover-page">
    <p className="eyebrow"><i />DISCOVER {city.toUpperCase()}</p>
    <h1>FIND YOUR<br /><span>SCENE.</span></h1>
    <p className="intro">Big nights. Little discoveries. Something worth stepping out for.</p>
    <div className="discover-switch">{[{ id: 'events', label: 'EVENTS' }, { id: 'map', label: 'NEARBY' }, { id: 'moments', label: 'POSTS' }, { id: 'people', label: 'PEOPLE' }].map((item) => <button key={item.id} className={mode === item.id ? 'selected' : ''} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
    {mode === 'map' ? <MapPage city={city} scenes={scenes} onSelect={onSelect} />
      : mode === 'moments' ? <><button className="share-moment" onClick={onCreateMoment}><ImagePlus size={17} /><span>CREATE A POST</span><ArrowRight size={16} /></button>{posts.length ? <div className="moment-grid">{posts.map((post) => <MomentCard key={post._id} post={post} user={user} onLike={() => onLike(post)} />)}</div> : <Empty title="No posts yet." text="Share a photo or video from a Scene." onCreate={onCreateMoment} />}</>
      : mode === 'people' ? <PeopleList people={people} onAdd={addFriend} />
      : <EventExplorer city={city} user={user} initialFilters={initialFilters} refreshKey={JSON.stringify(scenes.map((scene) => [scene.id, scene.updatedAt, scene.joined]))} onSelect={onSelect} Card={SceneCard} />}
  </section>
}

function MomentCard({ post, user, onLike }) {
  const liked = user && post.likes.includes(user.username)
  const profile = post.authorProfile
  return <article className="moment-card"><div className="moment-author"><div>{profile?.avatar ? <img src={avatarSrc(profile.avatar)} alt="" /> : (profile?.displayName || post.author).slice(0, 2).toUpperCase()}</div><span><b>{profile?.displayName || post.author}{post.isDemo && <span className="demo-badge">DEMO</span>}</b><small>{post.eventTitle || 'NIGHT OUT'} · {post.city}</small></span></div><div className="moment-media">{post.mediaType === 'video' ? <video src={post.mediaUrl} controls playsInline preload="metadata" /> : <EventImage src={post.mediaUrl} isDemo={post.isDemo} alt={post.caption || 'Event moment'} loading="lazy" />}</div><div className="moment-footer"><button className={liked ? 'liked' : ''} onClick={onLike}><Heart size={18} fill={liked ? 'currentColor' : 'none'} />{post.likes.length}</button>{post.caption && <p>{post.caption}</p>}</div></article>
}

function PeopleList({ people, onAdd }) {
  return people.length ? <div className="people-list">{people.map((person) => <article key={person._id} className="person-row">{person.avatar ? <img src={avatarSrc(person.avatar)} alt="" /> : <span>{person.username.slice(0, 2).toUpperCase()}</span>}<div><b>{person.displayName || person.username}{person.isDemo && <span className="demo-badge">DEMO</span>}</b><small>{person.city || '@' + person.username}</small>{person.bio && <p className="person-bio">{person.bio}</p>}{person.interests?.length > 0 && <div className="person-interests">{person.interests.slice(0, 3).map((interest) => <span key={interest}>{interest}</span>)}</div>}</div><button onClick={() => onAdd(person.username)}><UserPlus size={16} />ADD</button></article>)}</div> : <Empty title="No new people yet." text="People with public profiles will appear here." />
}

function MapPage({ city, scenes, onSelect }) {
  const [nearby, setNearby] = useState(scenes)
  const [view, setView] = useState('map')
  const [radius, setRadius] = useState(20)
  const [center, setCenter] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { const task = window.setTimeout(() => { setNearby(scenes); setCenter(null) }, 0); return () => window.clearTimeout(task) }, [city, scenes])
  useEffect(() => { if (!center) return; const controller = new AbortController(); const path = `/api/scenes/nearby?latitude=${center.lat}&longitude=${center.lng}&km=${radius}`; apiFetch(path, { signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setNearby(data.map(tidy)); setError('') }).catch((nextError) => { if (nextError.name !== 'AbortError') setError(nextError.message || 'Nearby Scenes could not be loaded.') }); return () => controller.abort() }, [center, radius])
  return <section className={'map-page map-view-' + view}><div className="map-tools"><span>EXPLORE NEARBY</span><label>RADIUS<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}><option value="5">5 km</option><option value="20">20 km</option><option value="50">50 km</option><option value="100">100 km</option></select></label><button className={view === 'map' ? 'selected' : ''} onClick={() => setView('map')}>MAP</button><button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}>LIST</button></div>{error && <p className="form-error map-error">{error}</p>}{view === 'map' && (cities[city] ? <div className="real-map"><LiveMap city={city} scenes={nearby} onSelect={onSelect} onViewport={setCenter} /></div> : <Empty title="Map center unavailable." text="Use the list for this city. Map browsing currently supports the listed city presets." />)}<section className="map-sheet"><SectionTitle eyebrow={'SCENES AROUND ' + city.toUpperCase()} title="NEARBY PLANS." />{nearby.length ? <div className="scene-list compact">{nearby.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="Your map is clear." text="Try a wider radius or host the first Scene in this area." />}</section></section>
}

function LiveMap({ city, scenes, onSelect, onViewport }) {
  const mapElement = useRef(null); const mapRef = useRef(null); const markerLayer = useRef(null); const lastCity = useRef(''); const viewport = useRef(onViewport)
  const [zoomVersion, setZoomVersion] = useState(0)
  useEffect(() => { viewport.current = onViewport }, [onViewport])
  useEffect(() => {
    const start = () => {
      if (!window.L || !mapElement.current) return
      if (!mapRef.current) { mapRef.current = window.L.map(mapElement.current, { zoomControl: true }); window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(mapRef.current); markerLayer.current = window.L.layerGroup().addTo(mapRef.current); mapRef.current.on('moveend', () => { const point = mapRef.current?.getCenter(); if (point) viewport.current({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) }) }); mapRef.current.on('zoomend', () => setZoomVersion((value) => value + 1)) }
      if (lastCity.current !== city) { lastCity.current = city; mapRef.current.setView(cities[city] || cities.Kochi, 12) }
      markerLayer.current.clearLayers()
      const zoom = mapRef.current.getZoom(); const size = zoom < 12 ? .05 : zoom < 14 ? .015 : 0
      const groups = new Map()
      scenes.filter((scene) => Number.isFinite(scene.latitude) && Number.isFinite(scene.longitude)).forEach((scene) => { const key = size ? `${Math.round(scene.latitude / size)}:${Math.round(scene.longitude / size)}` : scene.id; groups.set(key, [...(groups.get(key) || []), scene]) })
      groups.forEach((group) => { const first = group[0]; const clustered = group.length > 1; const icon = window.L.divIcon({ className: 'scene-marker', html: `<span>${clustered ? group.length : '●'}</span>`, iconSize: [34, 34] }); const marker = window.L.marker([first.latitude, first.longitude], { icon }).addTo(markerLayer.current); marker.on('click', () => clustered ? mapRef.current.setView([first.latitude, first.longitude], Math.min(18, zoom + 2)) : onSelect(first)) })
      window.setTimeout(() => mapRef.current?.invalidateSize(), 0)
    }
    if (window.L) start(); else window.addEventListener('leaflet-library-loaded', start)
    return () => window.removeEventListener('leaflet-library-loaded', start)
  }, [city, scenes, onSelect, zoomVersion])
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null }, [])
  return <div className="leaflet-host" ref={mapElement}><div className="map-overlay"><p className="eyebrow"><i />PUBLIC SCENE MAP</p><b>{city}</b><span>Tap a marker to view a Scene. Only hosts' shared event locations appear.</span></div></div>
}

function ProfilePage({ user, hosted, booked, onSelect, onSignIn, onEdit, onVerify, onLogout, onPlans }) {
  if (!user) return <section className="profile-page"><div className="profile-cover"><div className="cover-orb" /></div><div className="profile-card signed-out"><div className="big-avatar"><UserRound /></div><p className="eyebrow"><i />YOUR CORNER OF SCENE</p><h1>MAKE IT<br /><span>YOURS.</span></h1><p>Build your profile, keep bookings together and meet people who like the same things.</p><button className="button red" onClick={onSignIn}>SIGN IN TO CONTINUE <LogIn size={17} /></button></div></section>
  return <section className="profile-page">
    <div className="profile-page-heading"><p className="eyebrow"><i />YOUR CORNER OF SCENE</p><p>Your people. Your plans. All together.</p></div>
    <div className="profile-layout">
      <aside className="profile-summary" aria-label="Your profile">
        <div className="profile-cover"><div className="cover-orb" /></div>
        <div className="profile-card">
          <div className="profile-head">{user.avatar ? <img className="profile-avatar" src={avatarSrc(user.avatar)} alt="" /> : <div className="profile-avatar initials">{user.username.slice(0, 2).toUpperCase()}</div>}</div>
          <h1>{user.displayName || user.username}</h1>
          <p className="handle">@{user.username.toLowerCase().replaceAll(' ', '')}{user.city ? ' · ' + user.city : ''}</p>
          <p className="bio">{user.bio || 'Tell your city what you are into. Add a bio in Edit profile.'}</p>
          {user.interests?.length > 0 && <div className="profile-interests" aria-label="Interests">{user.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}
          {!user.emailVerified && <div className="verification-note"><span>Email not verified</span><button onClick={onVerify}>SEND VERIFICATION LINK</button></div>}
          <div className="profile-actions"><button className="button green" onClick={onEdit}>EDIT PROFILE</button><button className="text-action" onClick={onLogout}>LOG OUT</button></div>
          <div className="profile-stats"><span><b>{hosted.length}</b>HOSTED</span><span><b>{booked.length}</b>GOING</span><span><b>{hosted.filter((scene) => scene.publication === 'draft').length}</b>DRAFTS</span></div>
          <button className="profile-plans-link" onClick={onPlans}><Ticket size={20} /><span><b>MY PLANS & PASSES</b><small>Reservations, saved events and your organiser dashboard</small></span><ArrowRight size={18} /></button>
        </div>
      </aside>
      <div className="profile-activity">
        <section aria-labelledby="profile-plans-title">
          <div className="profile-section-heading"><div><p className="eyebrow"><Ticket size={15} />ON YOUR CALENDAR</p><h2 id="profile-plans-title">YOUR PLANS<span>.</span></h2></div><span className="section-count">{booked.length} plans</span></div>
          {booked.length ? <div className="scene-list compact">{booked.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="No upcoming plans yet." text="Join a Scene and it will appear here." />}
        </section>
        <section aria-labelledby="profile-hosted-title">
          <div className="profile-section-heading"><div><p className="eyebrow"><PartyPopper size={15} />BRINGING PEOPLE TOGETHER</p><h2 id="profile-hosted-title">HOSTED SCENES<span>.</span></h2></div><span className="section-count">{hosted.length} scenes</span></div>
          {hosted.length ? <div className="scene-list compact">{hosted.map((scene) => <SceneCard key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <Empty title="You have not hosted a Scene." text="Create a plan for your community." />}
        </section>
      </div>
    </div>
  </section>
}

function SceneCard({ scene, onClick }) {
  const styles = { Dining: 'card-dining', 'Food Meetups': 'card-dining', Party: 'card-party', Parties: 'card-party', Nightlife: 'card-party', 'DJ Nights': 'card-party', Meeting: 'card-meeting', Networking: 'card-meeting', Sport: 'card-sport', Sports: 'card-sport', 'Outdoor Activities': 'card-sport', Music: 'card-music', Concerts: 'card-music', Comedy: 'card-comedy', Workshops: 'card-workshop', Coffee: 'card-coffee' }
  const spots = Math.max(0, scene.capacity - scene.joined)
  const price = scene.price > 0 ? (scene.currency && scene.currency !== 'INR' ? scene.currency + ' ' : '₹') + Number(scene.price).toLocaleString('en-IN') : 'FREE'
  return <article className={'scene-card ' + (styles[scene.category] || 'card-other')}>
    <button className="scene-card-open" onClick={onClick} aria-label={'View ' + (scene.title || 'Untitled draft')}>
      <div className="scene-visual">{scene.image ? <EventImage src={scene.image} isDemo={scene.isDemo} alt="" loading="lazy" /> : <><span className="visual-sun" /><span className="visual-line" /></>}<span className="scene-tag">{scene.publication === 'draft' ? 'DRAFT' : scene.category}</span><span className="scene-time"><Clock3 size={13} />{scene.date} · {scene.time}</span></div>
      <div className="card-content"><p><MapPin size={13} />{scene.venue || scene.area}</p><h3>{scene.title || 'Untitled draft'}</h3><div><span className="attendees"><Users size={14} />{scene.joined}/{scene.capacity} going</span><b>{scene.eventStatus || 'UPCOMING'}</b></div><div className="card-booking-meta"><strong>{price}</strong><small>{scene.requestStatus === 'PENDING' ? 'Approval pending' : spots === 0 ? 'Sold out' : spots <= 3 ? 'Only ' + spots + ' spots left' : scene.joinType === 'approval' ? 'Host approval' : 'Instant confirmation'}</small></div></div>
    </button>
    <SaveSceneButton scene={scene} />
  </article>
}

function Empty({ title, text, onCreate }) { return <div className="empty-state"><Compass size={31} /><h3>{title}</h3><p>{text}</p>{onCreate && <button className="button red" onClick={onCreate}>CREATE A SCENE <Plus size={16} /></button>}</div> }

function SceneDialog({ scene, user, onClose, onJoin, onChat, onPass, onChanged, notify }) {
  const [editing, setEditing] = useState(false)
  const dialogRef = useDialogFocus(editing)
  const [joining, setJoining] = useState(false)
  const [requests, setRequests] = useState([])
  const isHost = user?.username === scene.host
  const joined = user && scene.members.includes(user.username)
  const closed = ['SOLD OUT', 'ENDED', 'CANCELLED'].includes(scene.eventStatus) || scene.status === 'cancelled' || scene.publication === 'draft' || scene.price > 0 || scene.paymentRequired || scene.registrationDeadline && new Date(scene.registrationDeadline) <= new Date()
  useEffect(() => { if (isHost && scene.id) apiFetch('/api/scenes/' + scene.id + '/requests').then((response) => response.ok ? response.json() : []).then(setRequests).catch(() => setRequests([])) }, [isHost, scene.id])
  useEffect(() => { const close = (event) => { if (event.key === 'Escape') onClose() }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  const manage = async (requestId, decision) => { try { const response = await apiFetch('/api/scenes/' + scene.id + '/requests/' + requestId, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ decision }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setRequests((current) => current.map((item) => item.id === requestId ? { ...item, status: decision } : item)); onChanged(data.scene); notify(decision === 'APPROVED' ? 'Guest approved.' : 'Request declined.') } catch (error) { notify(error.message || 'Could not update request.') } }
  const save = async (draft) => { try { const response = await apiFetch('/api/scenes/' + scene.id, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(draft) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onChanged(data); setEditing(false); notify('Scene updated.') } catch (error) { notify(error.message || 'Could not update Scene.') } }
  const cancel = async () => { if (!window.confirm('Cancel this Scene for everyone?')) return; try { const response = await apiFetch('/api/scenes/' + scene.id + '/cancel', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onChanged(data); notify('Scene cancelled.') } catch (error) { notify(error.message || 'Could not cancel Scene.') } }
  const leave = async () => { try { const response = await apiFetch('/api/scenes/' + scene.id + '/leave', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onChanged(data); notify('You left this Scene.') } catch (error) { notify(error.message || 'Could not leave Scene.') } }
  const goLive = async () => { try { const response = await apiFetch('/api/scenes/' + scene.id + '/live', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onChanged(data); notify('Your Scene is marked live.') } catch (error) { notify(error.message || 'Could not confirm live status.') } }
  const reserve = async () => { setJoining(true); try { await onJoin() } finally { setJoining(false) } }
  if (editing) return <CreateDialog city={scene.city} initial={scene} onClose={() => setEditing(false)} onCreate={save} />
  return <div className="overlay" onMouseDown={onClose}><section ref={dialogRef} className="modal scene-modal" role="dialog" aria-modal="true" aria-labelledby="scene-heading" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose} aria-label="Close Scene"><X /></button>
    <div className="modal-visual">{scene.image ? <EventImage src={scene.image} isDemo={scene.isDemo} alt="" /> : <div className="visual-sun" />}<span className="scene-tag">{scene.category}</span></div>
    <div className="modal-content">
      <p className="eyebrow"><i />{scene.eventStatus || 'UPCOMING'} · {scene.city} · {scene.area}</p>
      <h2 id="scene-heading">{scene.title || 'Untitled draft'}</h2>
      {scene.tags?.length > 0 && <div className="event-tags">{scene.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      {scene.description && <p className="description">{scene.description}</p>}
      <div className="facts"><span><CalendarDays />{scene.date}</span><span><Clock3 />{scene.time}{scene.timezone ? ' · ' + scene.timezone : ''}</span><span><MapPin />{scene.locationType === 'online' ? 'Online' : scene.venue}</span>{scene.address && <span>{scene.address}</span>}</div>
      {scene.publication !== 'draft' && <div className="event-tools"><SaveSceneButton scene={scene} label /><button className="event-tool" onClick={() => shareScene(scene, notify)}><Share2 size={16} />SHARE</button><DirectionsLink scene={scene} />{scene.startsAt && scene.endsAtDate && scene.status !== 'cancelled' && <button className="event-tool" onClick={() => downloadCalendar(scene, notify)}><CalendarDays size={16} />CALENDAR</button>}</div>}
      <div className="attendee-list"><div><b>{scene.joined} going</b><small>{Math.max(0, scene.capacity - scene.joined)} spots left · Hosted by {scene.host}</small></div>{joined && <ul>{scene.members.slice(0, 5).map((member) => <li key={member}>{member}</li>)}</ul>}</div>
      {scene.instructions && <p className="description">{scene.instructions}</p>}
      {scene.registrationDeadline && <p className="collection-note">Registration closes {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: scene.timezone || 'Asia/Kolkata' }).format(new Date(scene.registrationDeadline))}.</p>}
      {(scene.price > 0 || scene.paymentRequired) && <div className="payment-note"><b>PAID REGISTRATION UNAVAILABLE</b><span>This Scene needs a verified payment provider before online booking can open.</span></div>}
      {joined && !isHost && <button className="button green wide view-pass-action" onClick={onPass}><Ticket size={18} />VIEW YOUR PASS <ArrowRight size={16} /></button>}
      {isHost && scene.eventStatus === 'IN PROGRESS' && <button className="button green wide" onClick={goLive}>CONFIRM SCENE IS LIVE</button>}
      {isHost ? <><div className="profile-actions"><button className="button green" onClick={() => setEditing(true)}>EDIT SCENE</button>{scene.status !== 'cancelled' && <button className="text-action" onClick={cancel}>CANCEL SCENE</button>}</div>{requests.some((item) => item.status === 'PENDING') && <div className="request-list"><h3>JOIN REQUESTS</h3>{requests.filter((item) => item.status === 'PENDING').map((item) => <div key={item.id}><span>{item.username}</span><button onClick={() => manage(item.id, 'APPROVED')}>APPROVE</button><button onClick={() => manage(item.id, 'REJECTED')}>DECLINE</button></div>)}</div>}{joined && <button className="button green wide" onClick={onChat}><MessageCircle size={17} />OPEN GROUP CHAT</button>}</>
        : joined ? <div className="scene-actions"><button className="event-tool wide" onClick={onChat}><MessageCircle size={17} />OPEN GROUP CHAT</button><button className="draft-action" onClick={leave}>LEAVE THIS SCENE</button></div>
        : closed ? <button className="button wide" disabled>REGISTRATION CLOSED</button>
        : scene.requestStatus === 'PENDING' ? <div className="pending-reservation"><Clock3 size={20} /><div><b>REQUEST SENT</b><p>Waiting for the organiser. Track your request in My plans.</p></div></div>
        : <div className="reservation-bar"><div><b>FREE ENTRY</b><small>{scene.joinType === 'approval' ? 'Subject to organiser approval' : 'One spot. Instant confirmation.'}</small></div><button className="button green" disabled={joining} onClick={reserve}>{joining ? 'RESERVING...' : scene.joinType === 'approval' ? 'REQUEST TO JOIN' : 'RESERVE A SPOT'}<ArrowRight size={16} /></button></div>}
    </div>
  </section></div>
}

const localDateValue = (value) => { if (!value) return ''; const date = new Date(value); return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '' }
function CreateDialog({ city, onClose, onCreate, onPost, initial }) {
  const dialogRef = useDialogFocus()
  const [kind, setKind] = useState(initial?.kind || '')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ title: initial?.title || '', category: initial?.category || 'Casual Hangouts', city: initial?.city || city, area: initial?.area || '', venue: initial?.venue || '', address: initial?.address || '', locationType: initial?.locationType || 'in_person', latitude: initial?.latitude ?? '', longitude: initial?.longitude ?? '', startsAt: localDateValue(initial?.startsAt), endsAtDate: localDateValue(initial?.endsAtDate), registrationDeadline: localDateValue(initial?.registrationDeadline), timezone: initial?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', capacity: initial?.capacity || 10, description: initial?.description || '', instructions: initial?.instructions || '', image: initial?.image || '', tags: initial?.tags?.join(', ') || '', visibility: initial?.visibility || 'public', joinType: initial?.joinType || 'approval' })
  const update = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
  const payload = (publication) => ({ ...draft, kind, capacity: Number(draft.capacity), tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean), startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : '', endsAtDate: draft.endsAtDate ? new Date(draft.endsAtDate).toISOString() : '', registrationDeadline: draft.registrationDeadline ? new Date(draft.registrationDeadline).toISOString() : '', publication })
  const send = (publication) => { setError(''); if (publication === 'published' && (!draft.title.trim() || !draft.city.trim() || (draft.locationType !== 'online' && !draft.venue.trim()) || !draft.startsAt || !draft.endsAtDate)) { setError('Add a title, city, venue, start and end time before publishing.'); return } onCreate(payload(publication)) }
  const next = () => { if (step === 1 && !draft.title.trim()) return setError('Add a title to continue.'); if (step === 2 && (!draft.city.trim() || (draft.locationType !== 'online' && !draft.venue.trim()))) return setError('Add a city and venue to continue.'); if (step === 3 && (!draft.startsAt || !draft.endsAtDate || new Date(draft.startsAt) >= new Date(draft.endsAtDate))) return setError('Choose a valid start and end time.'); setError(''); setStep((current) => Math.min(5, current + 1)) }
  const chooseKind = (nextKind) => { setKind(nextKind); if (nextKind === 'quick' && !draft.startsAt) { const start = new Date(Date.now() + 30 * 60 * 1000); const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); setDraft((current) => ({ ...current, startsAt: localDateValue(start), endsAtDate: localDateValue(end), category: 'Casual Hangouts', joinType: 'open' })) } }
  const field = (label, name, placeholder = '', type = 'text') => <label>{label}<input name={name} value={draft[name]} onChange={update} placeholder={placeholder} type={type} /></label>
  return <div className="overlay" onMouseDown={onClose}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create a scene" className="modal create-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close"><X /></button>{!kind ? <><p className="eyebrow"><i />MAKE SOMETHING HAPPEN</p><h2>CREATE A<br /><span>SCENE.</span></h2><div className="create-choices"><button onClick={() => chooseKind('planned')}><CalendarDays /><span><b>CREATE A SCENE</b><small>Plan an event or meetup.</small></span><ArrowRight /></button><button onClick={() => chooseKind('quick')}><Clock3 /><span><b>QUICK SCENE</b><small>Make a spontaneous plan.</small></span><ArrowRight /></button><button onClick={onPost}><ImagePlus /><span><b>CREATE A POST</b><small>Share a photo or update.</small></span><ArrowRight /></button></div></> : <><p className="eyebrow"><i />{initial ? 'EDIT SCENE' : kind === 'quick' ? 'QUICK SCENE' : `CREATE A SCENE · STEP ${step} OF 5`}</p><h2>MAKE IT<br /><span>HAPPEN.</span></h2>{kind === 'planned' && <div className="wizard-steps" aria-label="Creation progress">{['INFO', 'PLACE', 'TIME', 'JOIN', 'REVIEW'].map((label, index) => <span key={label} className={step === index + 1 ? 'active' : ''}>{label}</span>)}</div>}{error && <p className="form-error">{error}</p>}
      {kind === 'quick' ? <div className="wizard-panel"><p className="form-note">A simple plan for the next few hours. The time and place can be changed before publishing.</p>{field('TITLE', 'title', 'Football at Kakkanad tonight')}{field('CITY', 'city', 'Kochi')}<div className="two">{field('AREA', 'area', 'Kakkanad')}{field('MEETING PLACE', 'venue', 'Public venue')}</div><div className="two">{field('STARTS', 'startsAt', '', 'datetime-local')}{field('ENDS', 'endsAtDate', '', 'datetime-local')}</div><div className="two">{field('CAPACITY', 'capacity', '', 'number')}<label>VISIBILITY<select name="visibility" value={draft.visibility} onChange={update}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label></div><label>JOINING<select name="joinType" value={draft.joinType} onChange={update}><option value="open">Instant join</option><option value="approval">Host approval</option></select></label><button className="button green wide" onClick={() => send('published')}>PUBLISH QUICK SCENE <ArrowRight size={16} /></button></div> : <div className="wizard-panel">{step === 1 && <>{field('TITLE', 'title', 'A night worth showing up for')}<label>CATEGORY<select name="category" value={draft.category} onChange={update}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>{field('TAGS, SEPARATED BY COMMAS', 'tags', 'live music, indie')}<label>DESCRIPTION<textarea name="description" value={draft.description} onChange={update} maxLength="500" placeholder="What will happen?" /></label>{field('COVER IMAGE HTTPS URL', 'image', 'https://...', 'url')}</>}{step === 2 && <><label>FORMAT<select name="locationType" value={draft.locationType} onChange={update}><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label>{field('CITY', 'city', 'Kochi')}{field('LOCALITY', 'area', 'Edappally')}{draft.locationType !== 'online' && <>{field('VENUE', 'venue', 'Cafe, club, stadium...')}{field('ADDRESS', 'address', 'Optional public address')}<p className="form-note">Tap the map to place a public venue. Private Scenes only reveal their place to authorized guests.</p><LocationPicker city={draft.city} latitude={draft.latitude} longitude={draft.longitude} onPick={(latitude, longitude) => setDraft((current) => ({ ...current, latitude, longitude }))} /></>}</>}{step === 3 && <>{field('STARTS', 'startsAt', '', 'datetime-local')}{field('ENDS', 'endsAtDate', '', 'datetime-local')}{field('TIMEZONE', 'timezone', 'Asia/Kolkata')}</>}{step === 4 && <>{field('CAPACITY', 'capacity', '', 'number')}{field('REGISTRATION DEADLINE (OPTIONAL)', 'registrationDeadline', '', 'datetime-local')}<label>JOINING<select name="joinType" value={draft.joinType} onChange={update}><option value="approval">Host approval</option><option value="open">Instant join</option></select></label><label>VISIBILITY<select name="visibility" value={draft.visibility} onChange={update}><option value="public">Public discovery</option><option value="unlisted">Unlisted link</option><option value="private">Private guests</option></select></label><label>PARTICIPATION NOTES<textarea name="instructions" value={draft.instructions} onChange={update} maxLength="1000" placeholder="What should guests bring or know?" /></label><p className="form-note">Paid booking will become available after a payment provider is configured.</p></>}{step === 5 && <div className="scene-preview"><b>{draft.title || 'Untitled Scene'}</b><span>{draft.category} · {draft.city}</span><span>{draft.venue || 'Online'} · {draft.startsAt || 'Time not set'}</span><span>{draft.capacity} spots · {draft.visibility} · {draft.joinType === 'open' ? 'Instant join' : 'Host approval'}</span></div>}<div className="wizard-actions">{step > 1 && <button className="text-action" onClick={() => setStep((current) => current - 1)}>BACK</button>}{step < 5 ? <button className="button green" onClick={next}>NEXT <ArrowRight size={16} /></button> : <button className="button green" onClick={() => send('published')}>{initial?.publication === 'draft' ? 'PUBLISH SCENE' : initial ? 'SAVE CHANGES' : 'PUBLISH SCENE'} <ArrowRight size={16} /></button>}</div><button className="draft-action" onClick={() => send('draft')}>SAVE AS DRAFT</button></div>}</>}</section></div>
}

function LocationPicker({ city, latitude, longitude, onPick }) {
  const element = useRef(null); const map = useRef(null); const marker = useRef(null); const pick = useRef(onPick)
  useEffect(() => { pick.current = onPick }, [onPick])
  useEffect(() => { const start = () => { if (!window.L || !element.current || map.current || !cities[city]) return; map.current = window.L.map(element.current).setView(cities[city], 12); window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map.current); map.current.on('click', (event) => pick.current(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)))); window.setTimeout(() => map.current?.invalidateSize(), 0) }; start(); window.addEventListener('leaflet-library-loaded', start); return () => { window.removeEventListener('leaflet-library-loaded', start); map.current?.remove(); map.current = null; marker.current = null } }, [city])
  useEffect(() => { if (!map.current || latitude === '' || longitude === '') return; const point = [Number(latitude), Number(longitude)]; if (marker.current) marker.current.setLatLng(point); else marker.current = window.L.marker(point).addTo(map.current) }, [latitude, longitude, city])
  return cities[city] ? <div className="location-picker" ref={element} aria-label="Choose a venue point on the map" /> : <p className="form-note">Map pin selection is not yet available for {city}. You can publish with the venue name and address.</p>
}

function MomentDialog({ onClose, onCreate }) {
  const dialogRef = useDialogFocus()
  const [draft, setDraft] = useState({ eventTitle: '', mediaType: 'image', mediaUrl: '', caption: '' })
  const update = (event) => setDraft({ ...draft, [event.target.name]: event.target.value })
  return <div className="overlay" onMouseDown={onClose}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create a post" className="modal moment-dialog" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close"><X /></button><p className="eyebrow"><i />SHARE YOUR SCENE</p><h2>CREATE A<br /><span>POST.</span></h2><p className="form-note">Share a public photo or video from an HTTPS URL. Uploaded media and expiring Moments are not available yet.</p><form onSubmit={(event) => { event.preventDefault(); onCreate(draft) }}><label>EVENT OR PLACE<input name="eventTitle" value={draft.eventTitle} onChange={update} placeholder="Saturday at the club" /></label><label>MEDIA TYPE<select name="mediaType" value={draft.mediaType} onChange={update}><option value="image">Photo</option><option value="video">Video</option></select></label><label>{draft.mediaType === 'video' ? 'VIDEO HTTPS URL' : 'PHOTO HTTPS URL'}<input name="mediaUrl" type="url" value={draft.mediaUrl} onChange={update} placeholder="https://..." required /></label><label>CAPTION<textarea name="caption" value={draft.caption} onChange={update} placeholder="How was the night?" maxLength="500" /></label><button className="button green wide">SHARE POST <ArrowRight size={17} /></button></form></section></div>
}

function Chat({ scene, user, onBack, onSignIn, notify }) {
  const [messages, setMessages] = useState([]); const [text, setText] = useState(''); const [error, setError] = useState('')
  useEffect(() => { if (sceneId(scene.id)) apiFetch('/api/scenes/' + scene.id + '/messages').then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data }).then(setMessages).catch((nextError) => setError(nextError.message || 'Chat could not be loaded.')) }, [scene.id])
  const send = async (event) => { event.preventDefault(); if (!user) { onSignIn(); return }; if (!text.trim()) return; try { const response = await apiFetch('/api/scenes/' + scene.id + '/messages', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ text }) }); const message = await response.json(); if (!response.ok) throw new Error(message.error); setMessages((current) => current.concat(message)); setText('') } catch (error) { notify(error.message || 'Message not sent.') } }
  return <section className="chat-page"><header className="chat-header"><button onClick={onBack}>← BACK</button><div><p className="eyebrow"><i />SCENE CHAT</p><h2>{scene.title}</h2></div></header><div className="messages">{error ? <p className="form-error">{error}</p> : messages.length ? messages.map((message) => <div key={message._id} className={message.sender === user?.username ? 'message mine' : 'message'}><b>{message.sender}</b><p>{message.text}</p></div>) : <Empty title="Start the conversation." text="Ask who is coming, coordinate a ride, or say hello." />}</div>{!error && <form className="composer" onSubmit={send}><input value={text} onChange={(event) => setText(event.target.value)} placeholder={user ? 'Write a message...' : 'Sign in to chat'} maxLength="2000" /><button aria-label="Send message"><Send size={18} /></button></form>}</section>
}

function ChatHub({ user, scenes, onOpen, onSignIn }) {
  return <section className="page chat-hub"><p className="eyebrow"><i />STAY IN THE LOOP</p><h1>YOUR<br /><span>CHATS.</span></h1>{!user ? <Empty title="Sign in to chat." text="Your Scene conversations will appear here." onCreate={onSignIn} /> : scenes.length ? <div className="scene-list">{scenes.map((scene) => <button className="chat-row" key={scene.id} onClick={() => onOpen(scene)}><MessageCircle /><span><b>{scene.title}</b><small>{scene.city} · {scene.date}</small></span><ArrowRight size={17} /></button>)}</div> : <Empty title="No chats yet." text="Join a Scene to talk with the group." />}</section>
}

function ProfileDialog({ user, onClose, onSaved, notify }) {
  const dialogRef = useDialogFocus()
  const [draft, setDraft] = useState({ displayName: user.displayName || user.username, city: user.city || '', bio: user.bio || '', avatar: user.avatar || '', interests: user.interests?.join(', ') || '', privateAccount: user.privateAccount || false, shareAttendance: user.shareAttendance || false })
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const update = (event) => { const { name, value, type, checked } = event.target; setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value })) }
  const choosePhoto = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { notify('Choose a PNG, JPEG, or WebP photo under 3 MB.'); event.target.value = ''; return }
    if (preview) URL.revokeObjectURL(preview)
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const submit = async (event) => {
    event.preventDefault(); setBusy(true)
    try {
      let avatar = draft.avatar
      if (photo) {
        const upload = await apiFetch('/api/users/me/avatar', { method: 'POST', headers: { 'Content-Type': photo.type }, body: photo })
        const result = await upload.json()
        if (!upload.ok) throw new Error(result.error)
        avatar = result.user.avatar
      }
      const response = await apiFetch('/api/users/me', { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ ...draft, avatar, interests: draft.interests.split(',').map((item) => item.trim()).filter(Boolean) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      onSaved(data.user)
    } catch (error) { notify(error.message || 'Could not save profile.') } finally { setBusy(false) }
  }
  return <div className="overlay" onMouseDown={onClose}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Edit your profile" className="modal create-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close"><X /></button><p className="eyebrow"><i />YOUR CORNER OF SCENE</p><h2>SET YOUR<br /><span>PROFILE.</span></h2><p className="form-note">Add a picture, bio, city, and interests to make your profile yours.</p><form onSubmit={submit}><div className="photo-editor"><div className="photo-preview">{preview || draft.avatar ? <img src={preview || avatarSrc(draft.avatar)} alt="Profile preview" /> : <UserRound />}</div><label>PROFILE PICTURE<input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} /></label>{(preview || draft.avatar) && <button type="button" className="text-action" onClick={() => { setPhoto(null); setPreview(''); setDraft((current) => ({ ...current, avatar: '' })) }}>REMOVE PHOTO</button>}</div><label>DISPLAY NAME<input name="displayName" value={draft.displayName} onChange={update} required maxLength="60" /></label><label>USERNAME<input value={user.username} disabled /></label><label>CITY<input name="city" value={draft.city} onChange={update} placeholder="Kochi" maxLength="60" /></label><label>BIO<textarea name="bio" value={draft.bio} onChange={update} maxLength="300" /></label><label>INTERESTS, SEPARATED BY COMMAS<input name="interests" value={draft.interests} onChange={update} placeholder="Music, football, food" /></label><label className="check-row"><input name="privateAccount" type="checkbox" checked={draft.privateAccount} onChange={update} />PRIVATE PROFILE</label><label className="check-row"><input name="shareAttendance" type="checkbox" checked={draft.shareAttendance} onChange={update} />SHARE MY ATTENDANCE WITH PEOPLE I FOLLOW</label><button className="button green wide" disabled={busy}>{busy ? 'SAVING...' : 'SAVE PROFILE'}</button></form></section></div>
}

function AuthDialog({ onClose, onAuthenticated, notify, standalone = false }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).has('reset') ? 'reset' : 'login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const path = mode === 'forgot' ? '/api/auth/password/forgot' : mode === 'reset' ? '/api/auth/password/reset' : '/api/auth/' + mode; const body = mode === 'reset' ? { token: new URLSearchParams(window.location.search).get('reset'), password: form.password } : form; const response = await apiFetch(path, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (mode === 'forgot') { notify(data.message); setMode('login') } else if (mode === 'reset') { window.history.replaceState({}, '', window.location.pathname); notify('Password changed. Sign in again.'); setMode('login') } else { onAuthenticated(data.user); if (mode === 'register') notify(data.verificationSent ? 'Account created. Check your email to verify it.' : 'Account created. Email delivery is not configured yet.') } } catch (nextError) { setError(nextError.message || 'Account request failed.') } finally { setBusy(false) } }
  const changeMode = (nextMode) => { setMode(nextMode); setError('') }
  const content = <section className={standalone ? 'auth-card' : 'modal auth-modal'} onMouseDown={standalone ? undefined : (event) => event.stopPropagation()}>
    {!standalone && <button className="close" onClick={onClose} aria-label="Close"><X /></button>}
    {!standalone && <p className="eyebrow"><i />YOUR SCENE STARTS HERE</p>}
    {['login', 'register'].includes(mode) && <div className="auth-tabs" role="group" aria-label="Account options"><button className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>SIGN IN</button><button className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => changeMode('register')}>SIGN UP</button></div>}
    <h2>{mode === 'login' ? 'WELCOME BACK.' : mode === 'register' ? 'JOIN SCENE.' : mode === 'forgot' ? 'RESET ACCESS.' : 'NEW PASSWORD.'}</h2>
    <p className="auth-card-copy">{mode === 'login' ? 'Your next story starts here.' : mode === 'register' ? 'Create an account and get out there.' : mode === 'forgot' ? 'We will send a reset link to your email.' : 'Choose a new password for your account.'}</p>
    <form onSubmit={submit}>{mode === 'register' && <label>USERNAME<input name="username" value={form.username} onChange={update} placeholder="A unique name" autoComplete="username" minLength="2" maxLength="30" required /></label>}{mode !== 'reset' && <label>EMAIL<input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" autoComplete="email" required /></label>}{mode !== 'forgot' && <label>PASSWORD<input name="password" type="password" value={form.password} onChange={update} placeholder="At least 8 characters" autoComplete={mode === 'register' || mode === 'reset' ? 'new-password' : 'current-password'} minLength="8" required /></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button green wide" disabled={busy}>{busy ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : mode === 'register' ? 'CREATE ACCOUNT' : mode === 'forgot' ? 'SEND RESET LINK' : 'CHANGE PASSWORD'}<ArrowRight size={17} /></button></form>
    {mode === 'login' && <button className="auth-switch" onClick={() => changeMode('forgot')}>FORGOT PASSWORD?</button>}
    {['forgot', 'reset'].includes(mode) && <button className="auth-switch" onClick={() => changeMode('login')}>BACK TO SIGN IN</button>}
  </section>
  return standalone ? content : <div className="overlay" onMouseDown={onClose}>{content}</div>
}

export default App
