import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bookmark, CalendarDays, MapPin, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { dateRange, eventCategories } from '../shared/events.js'

const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const presets = [{ value: '', label: 'ANYTIME' }, { value: 'today', label: 'TODAY' }, { value: 'tomorrow', label: 'TOMORROW' }, { value: 'weekend', label: 'THIS WEEKEND' }]

export default function EventExplorer({ city, user, initialFilters = {}, refreshKey, onSelect, Card }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(initialFilters.category || 'All')
  const [datePreset, setDatePreset] = useState(initialFilters.datePreset || '')
  const [customDate, setCustomDate] = useState('')
  const [price, setPrice] = useState(initialFilters.price || 'all')
  const [budget, setBudget] = useState('')
  const [kind, setKind] = useState('all')
  const [format, setFormat] = useState('all')
  const [sort, setSort] = useState('soonest')
  const [available, setAvailable] = useState(false)
  const [collection, setCollection] = useState(initialFilters.forYou ? 'forYou' : 'all')
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const searchVersion = useRef(0)
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  const range = useMemo(() => {
    if (customDate) {
      const from = new Date(customDate + 'T00:00:00'); const to = new Date(from)
      to.setDate(to.getDate() + 1)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    return dateRange(datePreset, now)
  }, [customDate, datePreset, now])
  const query = useMemo(() => {
    const params = new URLSearchParams({ city, limit: '12', sort })
    if (search.trim()) params.set('query', search.trim())
    if (category !== 'All') params.set('category', category)
    if (price !== 'all') params.set('price', price)
    if (budget !== '') params.set('maxPrice', budget)
    if (kind !== 'all') params.set('kind', kind)
    if (format !== 'all') params.set('locationType', format)
    if (available) params.set('availability', '1')
    if (collection !== 'all') params.set(collection, '1')
    if (range) { params.set('from', range.from); params.set('to', range.to) }
    return params.toString()
  }, [city, sort, search, category, price, budget, kind, format, available, collection, range])
  const interestsKey = JSON.stringify(user.interests || [])
  const savedKey = collection === 'saved' ? JSON.stringify(user.savedSceneIds || []) : ''
  useEffect(() => {
    searchVersion.current += 1
    const controller = new AbortController()
    const task = window.setTimeout(() => {
      setLoading(true); setError(''); setResults([]); setHasMore(false)
      fetch(apiBase + '/api/scenes?' + query + '&page=1', { credentials: 'include', signal: controller.signal }).then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setResults(data.map((scene) => ({ ...scene, id: scene._id, members: scene.members || [] })))
        setTotal(Number(response.headers.get('X-Total')) || data.length)
        setHasMore(response.headers.get('X-Has-More') === '1'); setPage(1)
      }).catch((error) => { if (error.name !== 'AbortError') setError(error.message || 'Events could not be loaded.') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { window.clearTimeout(task); controller.abort() }
  }, [query, refreshKey, retry, interestsKey, savedKey])
  const loadMore = async () => {
    const version = searchVersion.current
    setLoading(true)
    try {
      const response = await fetch(apiBase + '/api/scenes?' + query + '&page=' + (page + 1), { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (version !== searchVersion.current) return
      setResults((current) => [...current, ...data.map((scene) => ({ ...scene, id: scene._id, members: scene.members || [] }))])
      setHasMore(response.headers.get('X-Has-More') === '1'); setPage((current) => current + 1)
    } catch (error) { if (version === searchVersion.current) setError(error.message || 'More events could not be loaded.') }
    finally { if (version === searchVersion.current) setLoading(false) }
  }
  const clear = () => { setSearch(''); setCategory('All'); setDatePreset(''); setCustomDate(''); setPrice('all'); setBudget(''); setKind('all'); setFormat('all'); setAvailable(false); setSort('soonest'); setCollection('all') }
  const filtered = search || category !== 'All' || datePreset || customDate || price !== 'all' || budget || kind !== 'all' || format !== 'all' || available || collection !== 'all'
  return <div className="event-explorer">
    <label className="search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search events, venues and organisers" placeholder="A gig, a place, a new experience..." />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}</label>
    <div className="event-collections" aria-label="Event collections"><button className={collection === 'all' ? 'selected' : ''} onClick={() => setCollection('all')}>ALL EVENTS</button><button className={collection === 'forYou' ? 'selected' : ''} onClick={() => setCollection('forYou')}><Sparkles size={15} />FOR YOU</button><button className={collection === 'saved' ? 'selected' : ''} onClick={() => setCollection('saved')}><Bookmark size={15} />SAVED</button></div>
    {collection === 'forYou' && <p className="collection-note">{user.interests?.length ? 'Picked from your interests: ' + user.interests.join(', ') + '.' : 'Add interests in Edit profile to personalise this collection. Exploring all events for now.'}</p>}
    {collection === 'saved' && <p className="collection-note">Your saved events in {city}. Visit My plans to see saved events across all cities.</p>}
    <div className="category-scroll">{['All', ...eventCategories].map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="date-presets" aria-label="Event dates"><CalendarDays size={16} />{presets.map((preset) => <button key={preset.value} className={datePreset === preset.value && !customDate ? 'selected' : ''} onClick={() => { setDatePreset(preset.value); setCustomDate('') }}>{preset.label}</button>)}</div>
    <div className="event-filters"><label>CHOOSE DATE<input type="date" value={customDate} onChange={(event) => { setCustomDate(event.target.value); setDatePreset('') }} /></label><label>PRICE<select value={price} onChange={(event) => setPrice(event.target.value)}><option value="all">Any price</option><option value="free">Free entry</option><option value="paid">Paid events</option></select></label><label>BUDGET<select value={budget} onChange={(event) => setBudget(event.target.value)}><option value="">Any budget</option><option value="500">Under ₹500</option><option value="1000">Under ₹1,000</option><option value="2000">Under ₹2,000</option></select></label><label>FORMAT<select value={format} onChange={(event) => setFormat(event.target.value)}><option value="all">All formats</option><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label><label>TYPE<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All plans</option><option value="planned">Planned</option><option value="quick">Spontaneous</option></select></label><label>SORT<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="soonest">Soonest first</option><option value="newest">Just added</option><option value="mostJoined">Most popular</option></select></label><label className="check-filter"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />Spots available</label></div>
    <div className="results-row"><span><SlidersHorizontal size={14} />{loading && !results.length ? 'SEARCHING' : total + ' EVENTS'}{filtered && <button className="clear-filters" onClick={clear}>CLEAR FILTERS <X size={12} /></button>}</span><span><MapPin size={14} />{city.toUpperCase()}</span></div>
    {error ? <div className="search-error" role="alert"><p>{error}</p><button className="button green" onClick={() => setRetry((current) => current + 1)}>TRY AGAIN</button></div> : loading && !results.length ? <p className="loading-note" role="status">Finding your next good time...</p> : results.length ? <div className="scene-list">{results.map((scene) => <Card key={scene.id} scene={scene} onClick={() => onSelect(scene)} />)}</div> : <div className="empty-state"><Search size={30} /><h3>{collection === 'saved' ? 'No saved events here yet.' : 'No plans match just yet.'}</h3><p>{collection === 'saved' ? 'Save an event with the bookmark, or choose a different city.' : 'Try another category or date. Your next favourite memory could be one filter away.'}</p>{filtered && <button className="button green" onClick={clear}>EXPLORE ALL EVENTS <ArrowRight size={16} /></button>}</div>}
    {hasMore && !error && <button className="button green load-more" disabled={loading} onClick={loadMore}>{loading ? 'LOADING...' : 'SHOW MORE EVENTS'}<ArrowRight size={16} /></button>}
  </div>
}
