import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mongoose, { Schema } from 'mongoose'
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const app = express()
const port = Number(process.env.PORT || 4000)
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scene'
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim())
const authSecret = process.env.AUTH_SECRET || 'development-only-change-me'
const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
const secureCookie = process.env.NODE_ENV === 'production'
const scrypt = promisify(scryptCallback)
const isAllowedOrigin = (origin) => allowedOrigins.includes(origin) || (!secureCookie && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))

app.disable('x-powered-by')
app.use(cors({ credentials: true, origin(origin, callback) { if (!origin || isAllowedOrigin(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')) } }))
app.use(express.json({ limit: '1mb' }))
app.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('X-Frame-Options', 'DENY'); response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next() })

const requestSchema = new Schema({ userName: { type: String, required: true }, status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' } }, { timestamps: true })
const sceneSchema = new Schema({
  title: { type: String, default: 'Untitled scene', trim: true, maxlength: 80 }, category: { type: String, default: 'Other', trim: true, maxlength: 40 }, description: { type: String, default: '', maxlength: 500 },
  city: { type: String, default: 'Kochi', trim: true, maxlength: 60, index: true }, area: { type: String, default: 'Kochi', trim: true, maxlength: 80 }, venue: { type: String, default: 'To be announced', trim: true, maxlength: 120 }, latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 }, date: { type: String, default: 'TBD', trim: true, maxlength: 40 }, time: { type: String, default: 'TBD', trim: true, maxlength: 40 }, endsAt: { type: String, default: '' },
  joined: { type: Number, default: 1, min: 1 }, capacity: { type: Number, default: 10, min: 2, max: 1000 }, price: { type: Number, default: 0, min: 0 }, paymentRequired: { type: Boolean, default: false }, currency: { type: String, default: 'INR', maxlength: 3 }, ticketTypes: { type: [{ name: { type: String, maxlength: 40 }, price: { type: Number, min: 0 }, quantity: { type: Number, min: 1 } }], default: [] }, host: { type: String, default: 'Host', trim: true, maxlength: 60 }, image: { type: String, default: '' }, joinType: { type: String, enum: ['open', 'approval'], default: 'approval' }, status: { type: String, enum: ['open', 'full', 'cancelled'], default: 'open' }, members: { type: [String], default: [] }, requests: { type: [requestSchema], default: [] },
}, { timestamps: true })
const messageSchema = new Schema({ sceneId: { type: Schema.Types.ObjectId, required: true, index: true }, sender: { type: String, required: true, trim: true, maxlength: 60 }, text: { type: String, required: true, trim: true, maxlength: 2000 } }, { timestamps: true })
const bookingSchema = new Schema({ sceneId: { type: Schema.Types.ObjectId, required: true, index: true }, userName: { type: String, required: true, index: true }, ticketName: { type: String, default: 'General admission' }, quantity: { type: Number, min: 1, max: 10, default: 1 }, amount: { type: Number, min: 0, default: 0 }, paymentStatus: { type: String, enum: ['FREE', 'PENDING_PAYMENT', 'PAID'], default: 'FREE' } }, { timestamps: true })
const postSchema = new Schema({ city: { type: String, required: true, index: true }, author: { type: String, required: true, index: true }, eventTitle: { type: String, default: '', maxlength: 80 }, mediaType: { type: String, enum: ['image', 'video'], required: true }, mediaUrl: { type: String, required: true, maxlength: 2000 }, caption: { type: String, default: '', maxlength: 500 }, likes: { type: [String], default: [] } }, { timestamps: true })
const friendRequestSchema = new Schema({ requester: { type: String, required: true, index: true }, recipient: { type: String, required: true, index: true }, status: { type: String, enum: ['PENDING', 'ACCEPTED'], default: 'PENDING' } }, { timestamps: true })
const userSchema = new Schema({ username: { type: String, required: true, trim: true, minlength: 2, maxlength: 30, unique: true }, email: { type: String, required: true, trim: true, lowercase: true, unique: true }, passwordHash: { type: String, default: '' }, passwordSalt: { type: String, default: '' }, googleId: { type: String, unique: true, sparse: true }, avatar: { type: String, default: '' } }, { timestamps: true })
const Scene = mongoose.model('Scene', sceneSchema)
const Message = mongoose.model('Message', messageSchema)
const Booking = mongoose.model('Booking', bookingSchema)
const Post = mongoose.model('Post', postSchema)
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema)
const User = mongoose.model('User', userSchema)
const databaseReady = () => mongoose.connection.readyState === 1
const cookieValue = (request, name) => request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
const sign = (value) => createHmac('sha256', authSecret).update(value).digest('base64url')
const issueToken = (user) => { const payload = Buffer.from(JSON.stringify({ sub: user._id.toString(), username: user.username, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url'); return `${payload}.${sign(payload)}` }
const readToken = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || cookieValue(request, 'scene_session')
  if (!token?.includes('.')) return null
  const [payload, signature] = token.split('.')
  const expected = sign(payload)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? data : null } catch { return null }
}
app.use((request, _response, next) => { request.user = readToken(request); next() })
const requireUser = (request, response, next) => request.user ? next() : response.status(401).json({ error: 'Please sign in to continue.' })
const actor = (request) => request.user.username
const setSession = (response, user) => response.cookie('scene_session', issueToken(user), { httpOnly: true, secure: secureCookie, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7, path: '/' })

app.get('/api/auth/me', (request, response) => response.json({ user: request.user ? { username: request.user.username } : null }))
app.post('/api/auth/register', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  const username = String(request.body?.username || '').trim(); const email = String(request.body?.email || '').trim().toLowerCase(); const password = String(request.body?.password || '')
  if (!/^[a-zA-Z0-9_ -]{2,30}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return response.status(400).json({ error: 'Use a 2–30 character name, valid email, and password with at least 8 characters.' })
  const passwordSalt = randomBytes(16).toString('hex'); const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex')
  try { const user = await User.create({ username, email, passwordSalt, passwordHash }); setSession(response, user); response.status(201).json({ user: { username } }) } catch (error) { if (error?.code === 11000) return response.status(409).json({ error: 'That email or username is already in use.' }); throw error }
})
app.post('/api/auth/login', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  const email = String(request.body?.email || '').trim().toLowerCase(); const password = String(request.body?.password || ''); const user = await User.findOne({ email })
  if (!user) return response.status(401).json({ error: 'Email or password is incorrect.' })
  if (!user.passwordHash) return response.status(400).json({ error: 'This account uses Google sign-in.' })
  const candidate = (await scrypt(password, user.passwordSalt, 64)).toString('hex')
  if (candidate.length !== user.passwordHash.length || !timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash))) return response.status(401).json({ error: 'Email or password is incorrect.' })
  setSession(response, user); response.json({ user: { username: user.username } })
})
app.post('/api/auth/google', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  if (!googleClientId) return response.status(503).json({ error: 'Google sign-in has not been configured yet.' })
  const credential = String(request.body?.credential || '')
  if (!credential) return response.status(400).json({ error: 'Google credential is required.' })
  const verify = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
  if (!verify.ok) return response.status(401).json({ error: 'Google could not verify this account.' })
  const profile = await verify.json()
  if (profile.aud !== googleClientId || profile.email_verified !== 'true') return response.status(401).json({ error: 'Google account verification failed.' })
  const email = String(profile.email || '').toLowerCase(); const googleId = String(profile.sub || ''); const displayName = String(profile.name || email.split('@')[0]).slice(0, 30)
  let user = await User.findOne({ $or: [{ googleId }, { email }] })
  if (!user) {
    let username = displayName
    if (await User.exists({ username })) username = `${displayName.slice(0, 24)} ${randomBytes(2).toString('hex')}`
    user = await User.create({ username, email, googleId, avatar: String(profile.picture || '') })
  } else if (!user.googleId) { user.googleId = googleId; user.avatar = user.avatar || String(profile.picture || ''); await user.save() }
  setSession(response, user); response.json({ user: { username: user.username, avatar: user.avatar } })
})
app.post('/api/auth/logout', (_request, response) => { response.clearCookie('scene_session', { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' }); response.status(204).end() })

app.get('/api/people', requireUser, async (request, response) => {
  if (!databaseReady()) return response.json([])
  const query = String(request.query.query || '').trim(); const currentUser = actor(request)
  const people = await User.find({ username: { $ne: currentUser, ...(query ? { $regex: query, $options: 'i' } : {}) } }).select('username avatar').sort({ createdAt: -1 }).limit(30).lean()
  response.json(people)
})
app.get('/api/friends', requireUser, async (request, response) => {
  if (!databaseReady()) return response.json([])
  const currentUser = actor(request); const requests = await FriendRequest.find({ status: 'ACCEPTED', $or: [{ requester: currentUser }, { recipient: currentUser }] }).lean()
  const names = requests.map((item) => item.requester === currentUser ? item.recipient : item.requester)
  response.json(await User.find({ username: { $in: names } }).select('username avatar').lean())
})
app.post('/api/friends/request', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const requester = actor(request); const recipient = String(request.body?.recipient || '').trim()
  if (!recipient || recipient === requester) return response.status(400).json({ error: 'Choose another person.' })
  if (!await User.exists({ username: recipient })) return response.status(404).json({ error: 'Person not found.' })
  const existing = await FriendRequest.findOne({ $or: [{ requester, recipient }, { requester: recipient, recipient: requester }] })
  if (existing) { if (existing.requester === recipient && existing.status === 'PENDING') { existing.status = 'ACCEPTED'; await existing.save(); return response.json({ status: 'ACCEPTED' }) }; return response.json({ status: existing.status }) }
  await FriendRequest.create({ requester, recipient }); response.status(201).json({ status: 'PENDING' })
})
app.get('/api/posts', async (request, response) => {
  if (!databaseReady()) return response.json([])
  const city = String(request.query.city || '').trim(); response.json(await Post.find(city ? { city } : {}).sort({ createdAt: -1 }).limit(60).lean())
})
app.post('/api/posts', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const body = request.body || {}; const mediaUrl = String(body.mediaUrl || '').trim(); const city = String(body.city || '').trim()
  if (!/^https?:\/\//i.test(mediaUrl)) return response.status(400).json({ error: 'Add a valid image or video URL.' })
  if (!city) return response.status(400).json({ error: 'Choose a city for your moment.' })
  response.status(201).json(await Post.create({ city: city.slice(0, 60), author: actor(request), eventTitle: String(body.eventTitle || '').trim().slice(0, 80), mediaType: body.mediaType === 'video' ? 'video' : 'image', mediaUrl: mediaUrl.slice(0, 2000), caption: String(body.caption || '').trim().slice(0, 500) }))
})
app.post('/api/posts/:postId/like', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  if (!mongoose.isValidObjectId(request.params.postId)) return response.status(404).json({ error: 'Moment not found.' })
  const post = await Post.findById(request.params.postId); if (!post) return response.status(404).json({ error: 'Moment not found.' })
  const userName = actor(request); const liked = post.likes.includes(userName); post.likes = liked ? post.likes.filter((item) => item !== userName) : [...post.likes, userName]; await post.save(); response.json(post)
})

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: databaseReady() ? 'connected' : 'unavailable', timestamp: new Date().toISOString() }))
app.get('/api/scenes', async (request, response) => { if (!databaseReady()) return response.json([]); const city = typeof request.query.city === 'string' ? request.query.city.trim() : ''; response.json(await Scene.find({ status: 'open', ...(city ? { city } : {}) }).sort({ createdAt: -1 }).lean()) })
app.post('/api/scenes', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  const body = request.body || {}
  const capacity = Number(body.capacity) || 10; if (!Number.isInteger(capacity) || capacity < 2 || capacity > 1000) return response.status(400).json({ error: 'Capacity must be between 2 and 1000.' })
  const host = actor(request)
  const text = (value, fallback, maxLength) => typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback
  const latitude = Number(body.latitude); const longitude = Number(body.longitude)
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  const ticketTypes = Array.isArray(body.ticketTypes) ? body.ticketTypes.slice(0, 5).map((ticket) => ({ name: text(ticket?.name, 'General admission', 40), price: Math.max(0, Number(ticket?.price) || 0), quantity: Math.min(capacity, Math.max(1, Number(ticket?.quantity) || capacity)) })) : []
  const scene = await Scene.create({ ...body, title: text(body.title, 'Untitled scene', 80), category: text(body.category, 'Other', 40), city: text(body.city, 'Kochi', 60), area: text(body.area, 'Kochi', 80), venue: text(body.venue, 'To be announced', 120), date: text(body.date, 'TBD', 40), time: text(body.time, 'TBD', 40), description: String(body.description || '').trim().slice(0, 500), capacity, price: Math.max(0, Number(body.price) || 0), paymentRequired: Boolean(body.paymentRequired), latitude: hasCoordinates ? latitude : undefined, longitude: hasCoordinates ? longitude : undefined, ticketTypes, host, joined: 1, members: [host], joinType: body.joinType === 'open' ? 'open' : 'approval' })
  response.status(201).json(scene)
})
app.get('/api/bookings', requireUser, async (request, response) => { if (!databaseReady()) return response.json([]); response.json(await Booking.find({ userName: actor(request) }).sort({ createdAt: -1 }).lean()) })
app.post('/api/scenes/:sceneId/book', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const { sceneId } = request.params; if (!mongoose.isValidObjectId(sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(sceneId); if (!scene || scene.status !== 'open') return response.status(404).json({ error: 'Scene not found.' })
  const userName = actor(request); const quantity = Math.min(10, Math.max(1, Number(request.body?.quantity) || 1)); const ticketName = String(request.body?.ticketName || 'General admission').slice(0, 40)
  const ticket = scene.ticketTypes.find((item) => item.name === ticketName); const amount = (ticket?.price ?? scene.price ?? 0) * quantity
  const updated = await Scene.findOneAndUpdate({ _id: scene._id, status: 'open', $expr: { $lte: [{ $add: ['$joined', quantity] }, '$capacity'] } }, { $inc: { joined: quantity }, $addToSet: { members: userName } }, { new: true }).lean()
  if (!updated) return response.status(409).json({ error: 'There are not enough tickets left.' })
  const booking = await Booking.create({ sceneId: scene._id, userName, ticketName, quantity, amount, paymentStatus: amount ? 'PENDING_PAYMENT' : 'FREE' })
  response.status(201).json({ booking, scene: updated })
})
app.post('/api/scenes/:sceneId/join', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const { sceneId } = request.params; if (!mongoose.isValidObjectId(sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(sceneId); if (!scene || scene.status !== 'open') return response.status(404).json({ error: 'Scene not found.' })
  const userName = actor(request); if (scene.members.includes(userName)) return response.json({ status: 'JOINED', scene })
  if (scene.joinType === 'approval') { if (!scene.requests.some((item) => item.userName === userName && item.status === 'PENDING')) { scene.requests.push({ userName, status: 'PENDING' }); await scene.save() }; return response.status(202).json({ status: 'PENDING' }) }
  const updated = await Scene.findOneAndUpdate({ _id: scene._id, status: 'open', $expr: { $lt: ['$joined', '$capacity'] } }, { $inc: { joined: 1 }, $addToSet: { members: userName } }, { new: true }).lean()
  if (!updated) return response.status(409).json({ error: 'This scene is full.' }); response.json({ status: 'JOINED', scene: updated })
})
app.get('/api/scenes/:sceneId/messages', async (request, response) => { if (!databaseReady()) return response.json([]); if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' }); response.json(await Message.find({ sceneId: request.params.sceneId }).sort({ createdAt: 1 }).lean()) })
app.post('/api/scenes/:sceneId/messages', requireUser, async (request, response) => { if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' }); if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' }); const text = String(request.body?.text || '').trim(); if (!text || text.length > 2000) return response.status(400).json({ error: 'Message must be between 1 and 2000 characters.' }); response.status(201).json(await Message.create({ sceneId: request.params.sceneId, sender: actor(request), text })) })
app.use((error, _request, response, _next) => { console.error(error); response.status(500).json({ error: 'Something went wrong.' }) })

const server = app.listen(port, () => console.log(`Scene API listening on http://localhost:${port}`))
mongoose.connect(mongoUri).then(() => { console.log('Connected to MongoDB'); if (authSecret === 'development-only-change-me') console.warn('AUTH_SECRET is using its development value; set a strong secret before deployment.') }).catch((error) => console.warn('MongoDB unavailable; frontend demo mode remains available.', error.message))
const shutdown = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)))
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown)
