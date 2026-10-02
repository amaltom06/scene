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
const secureCookie = process.env.NODE_ENV === 'production'
const scrypt = promisify(scryptCallback)
const isAllowedOrigin = (origin) => allowedOrigins.includes(origin) || (!secureCookie && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))

app.disable('x-powered-by')
app.use(cors({ credentials: true, origin(origin, callback) { if (!origin || isAllowedOrigin(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')) } }))
app.use(express.json({ limit: '1mb' }))
app.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('X-Frame-Options', 'DENY'); response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next() })

const requestSchema = new Schema({ userName: { type: String, required: true }, status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' } }, { timestamps: true })
const sceneSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 }, category: { type: String, required: true, trim: true, maxlength: 40 }, description: { type: String, default: '', maxlength: 500 },
  area: { type: String, required: true, trim: true, maxlength: 80 }, venue: { type: String, required: true, trim: true, maxlength: 120 }, date: { type: String, required: true, trim: true, maxlength: 40 }, time: { type: String, required: true, trim: true, maxlength: 40 }, endsAt: { type: String, default: '', maxlength: 40 },
  joined: { type: Number, default: 1, min: 1 }, capacity: { type: Number, required: true, min: 2, max: 30 }, price: { type: Number, default: 0, min: 0 }, host: { type: String, required: true, trim: true, maxlength: 60 }, image: { type: String, default: '' }, joinType: { type: String, enum: ['open', 'approval'], default: 'approval' }, status: { type: String, enum: ['open', 'full', 'cancelled'], default: 'open' }, members: { type: [String], default: [] }, requests: { type: [requestSchema], default: [] },
}, { timestamps: true })
const messageSchema = new Schema({ sceneId: { type: Schema.Types.ObjectId, required: true, index: true }, sender: { type: String, required: true, trim: true, maxlength: 60 }, text: { type: String, required: true, trim: true, maxlength: 2000 } }, { timestamps: true })
const userSchema = new Schema({ username: { type: String, required: true, trim: true, minlength: 2, maxlength: 30, unique: true }, email: { type: String, required: true, trim: true, lowercase: true, unique: true }, passwordHash: { type: String, required: true }, passwordSalt: { type: String, required: true } }, { timestamps: true })
const Scene = mongoose.model('Scene', sceneSchema)
const Message = mongoose.model('Message', messageSchema)
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
  const candidate = (await scrypt(password, user.passwordSalt, 64)).toString('hex')
  if (candidate.length !== user.passwordHash.length || !timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash))) return response.status(401).json({ error: 'Email or password is incorrect.' })
  setSession(response, user); response.json({ user: { username: user.username } })
})
app.post('/api/auth/logout', (_request, response) => { response.clearCookie('scene_session', { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' }); response.status(204).end() })

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: databaseReady() ? 'connected' : 'unavailable', timestamp: new Date().toISOString() }))
app.get('/api/scenes', async (_request, response) => { if (!databaseReady()) return response.json([]); response.json(await Scene.find({ status: 'open' }).sort({ createdAt: -1 }).lean()) })
app.post('/api/scenes', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  const body = request.body || {}; const fields = ['title', 'category', 'area', 'venue', 'date', 'time']
  if (fields.some((field) => typeof body[field] !== 'string' || !body[field].trim())) return response.status(400).json({ error: 'Title, category, area, venue, date and time are required.' })
  const capacity = Number(body.capacity); if (!Number.isInteger(capacity) || capacity < 2 || capacity > 30) return response.status(400).json({ error: 'Capacity must be between 2 and 30.' })
  const host = actor(request)
  const scene = await Scene.create({ ...body, title: body.title.trim(), category: body.category.trim(), area: body.area.trim(), venue: body.venue.trim(), date: body.date.trim(), time: body.time.trim(), description: String(body.description || '').trim().slice(0, 500), capacity, price: Math.max(0, Number(body.price) || 0), host, joined: 1, members: [host], joinType: body.joinType === 'open' ? 'open' : 'approval' })
  response.status(201).json(scene)
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
