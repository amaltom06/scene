import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { Booking, FriendRequest, Message, Post, Scene, User } from './models.js'
import { readAvatar, writeAvatar } from './avatar-storage.js'
import { deploymentConfig } from './config.js'
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { eventCategories } from '../shared/events.js'

const app = express()
const { allowedOrigins, authSecret, publicAppUrl, secureCookie } = deploymentConfig()
const emailApiKey = process.env.RESEND_API_KEY || ''
const emailFrom = process.env.EMAIL_FROM || ''
const emailApiUrl = process.env.RESEND_API_URL || 'https://api.resend.com/emails'
const scrypt = promisify(scryptCallback)
const isAllowedOrigin = (origin) => allowedOrigins.includes(origin) || (!secureCookie && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))

app.disable('x-powered-by')
if (process.env.VERCEL === '1') app.set('trust proxy', 1)
app.use(cors({ credentials: true, origin(origin, callback) { callback(null, !origin || isAllowedOrigin(origin)) } }))
app.use((_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() })
app.use((_request, response, next) => { response.setHeader('Access-Control-Expose-Headers', 'X-Page, X-Has-More, X-Total'); next() })
app.use(express.json({ limit: '1mb' }))
app.use((request, response, next) => { if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin && !isAllowedOrigin(request.headers.origin)) return response.status(403).json({ error: 'Origin is not allowed.' }); next() })
app.use((_request, response, next) => { response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('X-Frame-Options', 'DENY'); response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next() })

const databaseReady = () => mongoose.connection.readyState === 1
const cookieValue = (request, name) => request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
const sign = (value) => createHmac('sha256', authSecret).update(value).digest('base64url')
const issueToken = (user) => { const payload = Buffer.from(JSON.stringify({ sub: user._id.toString(), ver: user.sessionVersion || 0, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url'); return `${payload}.${sign(payload)}` }
const readToken = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || cookieValue(request, 'scene_session')
  if (!token?.includes('.')) return null
  const [payload, signature] = token.split('.')
  const expected = sign(payload)
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? data : null } catch { return null }
}
app.use(async (request, _response, next) => { try { const token = readToken(request); const user = token && databaseReady() ? await User.findById(token.sub) : null; request.user = user && (user.sessionVersion || 0) === (token.ver || 0) ? user : null; next() } catch (error) { next(error) } })
const requireUser = (request, response, next) => request.user ? next() : response.status(401).json({ error: 'Please sign in to continue.' })
const actor = (request) => request.user.username
const setSession = (response, user) => response.cookie('scene_session', issueToken(user), { httpOnly: true, secure: secureCookie, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7, path: '/' })
const publicUser = (user) => ({ username: user.username, displayName: user.displayName || user.username, avatar: user.avatar, bio: user.bio, city: user.city, interests: user.interests || [], privateAccount: user.privateAccount, isDemo: Boolean(user.isDemo) })
const ownUser = (user) => ({ ...publicUser(user), email: user.email, emailVerified: user.emailVerified || Boolean(user.googleId), shareAttendance: user.shareAttendance, onboarded: user.onboarded, savedSceneIds: (user.savedScenes || []).map(String) })
const cleanText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const validUrl = (value) => !value || /^https:\/\//i.test(value)
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tokenHash = (value) => createHash('sha256').update(value).digest('hex')
const mailConfigured = () => Boolean(emailApiKey && emailFrom && publicAppUrl)
const mail = async (to, subject, html) => {
  const response = await fetch(emailApiUrl, { method: 'POST', headers: { Authorization: `Bearer ${emailApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: emailFrom, to: [to], subject, html }) })
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`)
}
const sendAccountLink = async (user, purpose) => {
  if (!mailConfigured()) return false
  const token = randomBytes(32).toString('base64url')
  const isReset = purpose === 'reset'
  user[isReset ? 'resetHash' : 'verificationHash'] = tokenHash(token)
  user[isReset ? 'resetExpiresAt' : 'verificationExpiresAt'] = new Date(Date.now() + (isReset ? 30 : 60) * 60 * 1000)
  await user.save()
  const url = `${publicAppUrl.replace(/\/$/, '')}/?${isReset ? 'reset' : 'verify'}=${encodeURIComponent(token)}`
  await mail(user.email, isReset ? 'Reset your SCENE password' : 'Verify your SCENE email', `<p>${isReset ? 'Reset your password' : 'Verify your email'} by opening this link:</p><p><a href="${url}">${url}</a></p><p>This link expires soon. If you did not request it, ignore this email.</p>`)
  return true
}
const authAttempts = new Map()
const authLimit = (request, response, next) => { const key = request.ip || 'unknown'; const now = Date.now(); const previous = authAttempts.get(key) || []; const recent = previous.filter((time) => now - time < 15 * 60 * 1000); if (recent.length >= 30) return response.status(429).json({ error: 'Too many account requests. Try again later.' }); recent.push(now); authAttempts.set(key, recent); next() }
const categories = new Set([...eventCategories, 'Dining', 'Party', 'Meeting', 'Sport', 'Music', 'Coffee', 'Other'])
const publicSceneFilter = { status: { $ne: 'cancelled' }, publication: { $ne: 'draft' }, visibility: { $nin: ['private', 'unlisted'] } }
const sceneAccess = (scene, request) => scene.visibility !== 'private' && scene.publication !== 'draft' || Boolean(request.user && (scene.hostId?.toString() === request.user._id.toString() || scene.host === actor(request) || scene.members?.includes(actor(request))))
const sceneStatus = (scene) => {
  if (scene.status === 'cancelled') return 'CANCELLED'
  if (!scene.startsAt || !scene.endsAtDate) return scene.joined >= scene.capacity ? 'SOLD OUT' : 'UPCOMING'
  const now = Date.now(); const start = new Date(scene.startsAt).getTime(); const end = new Date(scene.endsAtDate).getTime()
  if (end <= now) return 'ENDED'
  if (scene.joined >= scene.capacity) return 'SOLD OUT'
  if (start <= now) return scene.liveConfirmed ? 'LIVE NOW' : 'IN PROGRESS'
  return start - now < 60 * 60 * 1000 ? 'STARTING SOON' : 'UPCOMING'
}
const sceneView = (scene, request) => {
  const data = scene.toObject ? scene.toObject() : { ...scene }
  const canSeeMembers = request.user && (data.host === actor(request) || data.members?.includes(actor(request)))
  data.requestStatus = request.user ? data.requests?.find((item) => item.userName === actor(request) && item.status === 'PENDING')?.status || null : null
  if (request.user && data.host === actor(request)) data.pendingRequests = data.requests?.filter((item) => item.status === 'PENDING').length || 0
  delete data.requests
  delete data.demoKey
  if (!canSeeMembers) data.members = []
  if (data.visibility === 'private' && !canSeeMembers) { delete data.address; delete data.latitude; delete data.longitude; delete data.location }
  data.eventStatus = sceneStatus(data)
  return data
}
const parseScene = (body, publish) => {
  const title = cleanText(body.title, 80); const category = cleanText(body.category, 40); const city = cleanText(body.city, 60)
  const venue = cleanText(body.venue, 120); const image = cleanText(body.image, 2000)
  const capacity = Number(body.capacity); const startsAt = new Date(body.startsAt); const endsAtDate = new Date(body.endsAtDate)
  const registrationDeadline = body.registrationDeadline ? new Date(body.registrationDeadline) : null
  const timezone = cleanText(body.timezone, 80) || 'Asia/Kolkata'
  const locationType = ['in_person', 'online', 'hybrid'].includes(body.locationType) ? body.locationType : 'in_person'
  const visibility = ['public', 'unlisted', 'private'].includes(body.visibility) ? body.visibility : 'public'
  const kind = body.kind === 'quick' ? 'quick' : 'planned'
  const latitude = body.latitude === '' || body.latitude == null ? null : Number(body.latitude)
  const longitude = body.longitude === '' || body.longitude == null ? null : Number(body.longitude)
  if (publish && (!title || !city || !category || !categories.has(category) || (locationType !== 'online' && !venue))) return { error: 'Add a title, category, city, and venue before publishing.' }
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 1000) return { error: 'Capacity must be between 2 and 1000.' }
  if (publish && (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAtDate.getTime()) || startsAt >= endsAtDate)) return { error: 'Enter a valid start and end time; the end must be later.' }
  if (publish && endsAtDate.getTime() <= Date.now()) return { error: 'A published Scene must end in the future.' }
  if (registrationDeadline && (!Number.isFinite(registrationDeadline.getTime()) || registrationDeadline >= startsAt)) return { error: 'Registration must close before the Scene starts.' }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }) } catch { return { error: 'Choose a valid timezone.' } }
  if (!validUrl(image)) return { error: 'Cover image must use an HTTPS URL.' }
  if ((latitude === null) !== (longitude === null) || latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) return { error: 'Choose a valid map location.' }
  if (Number(body.price || 0) > 0 || body.paymentRequired) return { error: 'Paid reservations are unavailable until a payment provider is connected. Publish a free Scene for now.' }
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => cleanText(tag, 32)).filter(Boolean))].slice(0, 8) : []
  const data = { title, category: category || 'Other', description: cleanText(body.description, 500), city, area: cleanText(body.area, 80) || city, venue: venue || 'Online', address: cleanText(body.address, 240), image, capacity, startsAt: Number.isFinite(startsAt.getTime()) ? startsAt : undefined, endsAtDate: Number.isFinite(endsAtDate.getTime()) ? endsAtDate : undefined, registrationDeadline: registrationDeadline || undefined, timezone, locationType, visibility, kind, tags, instructions: cleanText(body.instructions, 1000), joinType: body.joinType === 'open' ? 'open' : 'approval', latitude: latitude ?? undefined, longitude: longitude ?? undefined, location: latitude === null ? undefined : { type: 'Point', coordinates: [longitude, latitude] } }
  if (data.startsAt) { data.date = new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium' }).format(data.startsAt); data.time = new Intl.DateTimeFormat('en-IN', { timeZone: timezone, timeStyle: 'short' }).format(data.startsAt) }
  return { data }
}

app.get('/api/auth/me', (request, response) => response.json({ user: request.user ? ownUser(request.user) : null }))
app.post('/api/auth/register', authLimit, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  const username = String(request.body?.username || '').trim().toLowerCase(); const email = String(request.body?.email || '').trim().toLowerCase(); const password = String(request.body?.password || '')
  if (!/^[a-z0-9_]{2,30}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) return response.status(400).json({ error: 'Use a 2–30 character username with letters, numbers or underscores, a valid email, and an 8–128 character password.' })
  const passwordSalt = randomBytes(16).toString('hex'); const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex')
  try { const user = await User.create({ username, email, passwordSalt, passwordHash, displayName: username }); setSession(response, user); let verificationSent = false; try { verificationSent = await sendAccountLink(user, 'verify') } catch (mailError) { console.warn('Verification email could not be sent:', mailError.message) }; response.status(201).json({ user: ownUser(user), verificationSent }) } catch (error) { if (error?.code === 11000) return response.status(409).json({ error: 'That email or username is already in use.' }); throw error }
})
app.post('/api/auth/login', authLimit, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable. Try again shortly.' })
  const email = String(request.body?.email || '').trim().toLowerCase(); const password = String(request.body?.password || ''); const user = await User.findOne({ email })
  if (!user) return response.status(401).json({ error: 'Email or password is incorrect.' })
  if (secureCookie && user.isDemo) return response.status(401).json({ error: 'Demo accounts are only available in local development.' })
  if (!user.passwordHash) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const candidate = (await scrypt(password, user.passwordSalt, 64)).toString('hex')
  if (candidate.length !== user.passwordHash.length || !timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash))) return response.status(401).json({ error: 'Email or password is incorrect.' })
  setSession(response, user); response.json({ user: ownUser(user) })
})
app.post('/api/auth/logout', async (request, response) => { if (request.user) { request.user.sessionVersion = (request.user.sessionVersion || 0) + 1; await request.user.save() }; response.clearCookie('scene_session', { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/' }); response.status(204).end() })
app.post('/api/auth/verification/request', authLimit, requireUser, async (request, response) => {
  if (request.user.emailVerified) return response.json({ sent: false, message: 'Email is already verified.' })
  if (!mailConfigured()) return response.status(503).json({ error: 'Email delivery has not been configured.' })
  await sendAccountLink(request.user, 'verify'); response.json({ sent: true })
})
app.post('/api/auth/verify', authLimit, async (request, response) => {
  const token = cleanText(request.body?.token, 200)
  if (!token) return response.status(400).json({ error: 'Verification token is required.' })
  const user = await User.findOne({ verificationHash: tokenHash(token), verificationExpiresAt: { $gt: new Date() } })
  if (!user) return response.status(400).json({ error: 'This verification link is invalid or expired.' })
  user.emailVerified = true; user.verificationHash = ''; user.verificationExpiresAt = undefined; await user.save()
  response.json({ verified: true })
})
app.post('/api/auth/password/forgot', authLimit, async (request, response) => {
  if (!mailConfigured()) return response.status(503).json({ error: 'Email delivery has not been configured.' })
  const email = cleanText(request.body?.email, 254).toLowerCase()
  const user = await User.findOne({ email })
  if (user) await sendAccountLink(user, 'reset')
  response.json({ message: 'If an account exists, a password reset link has been sent.' })
})
app.post('/api/auth/password/reset', authLimit, async (request, response) => {
  const token = cleanText(request.body?.token, 200); const password = String(request.body?.password || '')
  if (!token || password.length < 8 || password.length > 128) return response.status(400).json({ error: 'Use a valid reset link and a password of 8–128 characters.' })
  const user = await User.findOne({ resetHash: tokenHash(token), resetExpiresAt: { $gt: new Date() } })
  if (!user) return response.status(400).json({ error: 'This reset link is invalid or expired.' })
  user.passwordSalt = randomBytes(16).toString('hex'); user.passwordHash = (await scrypt(password, user.passwordSalt, 64)).toString('hex')
  user.resetHash = ''; user.resetExpiresAt = undefined; user.sessionVersion = (user.sessionVersion || 0) + 1; await user.save()
  response.json({ reset: true })
})

app.patch('/api/users/me', requireUser, async (request, response) => {
  const body = request.body || {}
  const displayName = cleanText(body.displayName, 60)
  const city = cleanText(body.city, 60)
  const avatar = cleanText(body.avatar, 2000)
  if (!displayName || !(validUrl(avatar) || /^\/api\/avatars\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(avatar))) return response.status(400).json({ error: 'Add a display name and use an uploaded photo or HTTPS image URL.' })
  const interests = Array.isArray(body.interests) ? [...new Set(body.interests.map((item) => cleanText(item, 32)).filter(Boolean))].slice(0, 12) : []
  Object.assign(request.user, { displayName, city, avatar, bio: cleanText(body.bio, 300), interests, privateAccount: body.privateAccount === true, shareAttendance: body.shareAttendance === true, onboarded: true })
  await request.user.save()
  response.json({ user: ownUser(request.user) })
})
const avatarType = (bytes) => {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}
app.post('/api/users/me/avatar', requireUser, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '3mb' }), async (request, response) => {
  if (!Buffer.isBuffer(request.body) || request.body.length < 16 || request.body.length > 3 * 1024 * 1024) return response.status(400).json({ error: 'Choose a PNG, JPEG, or WebP image under 3 MB.' })
  const extension = avatarType(request.body)
  const expected = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[extension]
  if (!expected || request.headers['content-type'] !== expected) return response.status(400).json({ error: 'The image type does not match the uploaded file.' })
  const filename = `${randomBytes(16).toString('hex')}.${extension}`
  await writeAvatar(filename, request.body)
  request.user.avatar = `/api/avatars/${filename}`
  await request.user.save()
  response.json({ user: ownUser(request.user) })
})
app.get('/api/avatars/:filename', async (request, response) => {
  const { filename } = request.params
  if (!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(filename)) return response.status(404).end()
  try {
    const bytes = await readAvatar(filename)
    if (!bytes) return response.status(404).end()
    response.type(filename.endsWith('.jpg') ? 'image/jpeg' : `image/${filename.split('.')[1]}`)
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.send(bytes)
  } catch (error) { if (error?.code === 'ENOENT') return response.status(404).end(); throw error }
})
app.get('/api/users/:username', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const user = await User.findOne({ username: request.params.username })
  if (!user) return response.status(404).json({ error: 'Person not found.' })
  if (user.privateAccount && request.user?._id.toString() !== user._id.toString()) return response.status(403).json({ error: 'This profile is private.' })
  response.json({ user: publicUser(user) })
})

app.get('/api/people', requireUser, async (request, response) => {
  if (!databaseReady()) return response.json([])
  const query = String(request.query.query || '').trim(); const currentUser = actor(request)
  const people = await User.find({ privateAccount: { $ne: true }, username: { $ne: currentUser, ...(query ? { $regex: escapeRegex(query.slice(0, 40)), $options: 'i' } : {}) } }).select('username displayName avatar city bio interests isDemo').sort({ createdAt: -1 }).limit(30).lean()
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
  const city = String(request.query.city || '').trim()
  const posts = await Post.find(city ? { city } : {}).sort({ createdAt: -1 }).limit(60).lean()
  const authors = await User.find({ username: { $in: [...new Set(posts.map((post) => post.author))] }, privateAccount: { $ne: true } }).select('username displayName avatar isDemo').lean()
  const profiles = new Map(authors.map((user) => [user.username, user]))
  response.json(posts.map(({ demoKey: _demoKey, ...post }) => ({ ...post, authorProfile: profiles.get(post.author) || null })))
})
app.post('/api/posts', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const body = request.body || {}; const mediaUrl = String(body.mediaUrl || '').trim(); const city = String(body.city || '').trim()
  if (!/^https:\/\//i.test(mediaUrl)) return response.status(400).json({ error: 'Add an HTTPS image or video URL.' })
  if (!city) return response.status(400).json({ error: 'Choose a city for your moment.' })
  response.status(201).json(await Post.create({ city: city.slice(0, 60), author: actor(request), eventTitle: String(body.eventTitle || '').trim().slice(0, 80), mediaType: body.mediaType === 'video' ? 'video' : 'image', mediaUrl: mediaUrl.slice(0, 2000), caption: String(body.caption || '').trim().slice(0, 500) }))
})
app.post('/api/posts/:postId/like', requireUser, async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  if (!mongoose.isValidObjectId(request.params.postId)) return response.status(404).json({ error: 'Moment not found.' })
  const post = await Post.findById(request.params.postId); if (!post) return response.status(404).json({ error: 'Moment not found.' })
  const userName = actor(request); const liked = post.likes.includes(userName); post.likes = liked ? post.likes.filter((item) => item !== userName) : [...post.likes, userName]; await post.save(); response.json(post)
})

app.get('/api/health', (_request, response) => response.status(databaseReady() ? 200 : 503).json({ status: databaseReady() ? 'ok' : 'unavailable', database: databaseReady() ? 'connected' : 'unavailable', timestamp: new Date().toISOString() }))
app.get('/api/scenes', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const city = cleanText(request.query.city, 60); const search = cleanText(request.query.query, 80); const category = cleanText(request.query.category, 40)
  const page = Math.max(1, Math.min(1000, Number.parseInt(request.query.page, 10) || 1)); const limit = Math.max(1, Math.min(50, Number.parseInt(request.query.limit, 10) || 30))
  if (['mine', 'participating', 'saved', 'requested'].some((key) => request.query[key] === '1') && !request.user) return response.status(401).json({ error: 'Please sign in to continue.' })
  const access = request.user ? { $or: [{ visibility: { $ne: 'private' }, publication: { $ne: 'draft' } }, { hostId: request.user._id }, { host: actor(request) }, { members: actor(request) }] } : {}
  const filter = request.query.mine === '1' ? { $or: [{ hostId: request.user._id }, { host: actor(request) }] }
    : request.query.participating === '1' ? { members: actor(request) }
    : request.query.saved === '1' ? { _id: { $in: request.user.savedScenes || [] }, ...access }
    : request.query.requested === '1' ? { requests: { $elemMatch: { userName: actor(request), status: 'PENDING' } }, ...access }
    : { ...publicSceneFilter, $and: [{ $or: [{ endsAtDate: { $gt: new Date() } }, { endsAtDate: { $exists: false } }] }] }
  if (city) filter.city = city
  if (category && categories.has(category)) filter.category = category
  if (search) { filter.$and ||= []; filter.$and.push({ $or: [{ title: { $regex: escapeRegex(search), $options: 'i' } }, { venue: { $regex: escapeRegex(search), $options: 'i' } }, { area: { $regex: escapeRegex(search), $options: 'i' } }, { host: { $regex: escapeRegex(search), $options: 'i' } }] }) }
  if (['quick', 'planned'].includes(request.query.kind)) filter.kind = request.query.kind
  if (['in_person', 'online', 'hybrid'].includes(request.query.locationType)) filter.locationType = request.query.locationType
  if (request.query.forYou === '1') {
    if (!request.user) return response.status(401).json({ error: 'Please sign in for recommendations.' })
    const interests = request.user.interests.filter((item) => categories.has(item))
    if (interests.length) { filter.$and ||= []; filter.$and.push({ category: { $in: interests } }) }
  }
  if (request.query.availability === '1') { filter.$and ||= []; filter.$and.push({ $expr: { $lt: ['$joined', '$capacity'] } }) }
  if (request.query.price === 'free') { filter.price = 0; filter.paymentRequired = { $ne: true } }
  if (request.query.price === 'paid') { filter.$and ||= []; filter.$and.push({ $or: [{ price: { $gt: 0 } }, { paymentRequired: true }] }) }
  if (request.query.maxPrice != null) {
    const maxPrice = Number(request.query.maxPrice)
    if (!Number.isFinite(maxPrice) || maxPrice < 0) return response.status(400).json({ error: 'Use a valid maximum price.' })
    filter.$and ||= []; filter.$and.push({ price: { $lte: maxPrice }, ...(maxPrice === 0 ? { paymentRequired: { $ne: true } } : {}) })
  }
  const from = request.query.from ? new Date(request.query.from) : null; const to = request.query.to ? new Date(request.query.to) : null
  if (from && !Number.isFinite(from.getTime()) || to && !Number.isFinite(to.getTime())) return response.status(400).json({ error: 'Use valid date filters.' })
  if (from && to && from >= to) return response.status(400).json({ error: 'The date range must end after it starts.' })
  if (from || to) filter.startsAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) }
  const sort = request.query.sort === 'newest' ? { createdAt: -1 } : request.query.sort === 'mostJoined' ? { joined: -1, startsAt: 1 } : { startsAt: 1, createdAt: -1 }
  const [scenes, total] = await Promise.all([Scene.find(filter).sort(sort).skip((page - 1) * limit).limit(limit + 1).lean(), Scene.countDocuments(filter)])
  response.setHeader('X-Page', String(page)); response.setHeader('X-Has-More', scenes.length > limit ? '1' : '0'); response.setHeader('X-Total', String(total)); response.json(scenes.slice(0, limit).map((scene) => sceneView(scene, request)))
})
app.get('/api/scenes/nearby', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  const latitude = Number(request.query.latitude); const longitude = Number(request.query.longitude); const km = Math.min(100, Math.max(1, Number(request.query.km) || 20))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return response.status(400).json({ error: 'Valid map coordinates are required.' })
  const category = cleanText(request.query.category, 40)
  const scenes = await Scene.find({ ...publicSceneFilter, ...(category && categories.has(category) ? { category } : {}), $or: [{ endsAtDate: { $gt: new Date() } }, { endsAtDate: { $exists: false } }], location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [longitude, latitude] }, $maxDistance: km * 1000 } } }).limit(50).lean()
  response.json(scenes.map((scene) => sceneView(scene, request)))
})
app.get('/api/scenes/:sceneId', async (request, response) => {
  if (!databaseReady()) return response.status(503).json({ error: 'Database is unavailable.' })
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId).lean()
  if (!scene || !sceneAccess(scene, request)) return response.status(404).json({ error: 'Scene not found.' })
  response.json(sceneView(scene, request))
})
app.put('/api/scenes/:sceneId/save', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId).lean()
  if (!scene || !sceneAccess(scene, request) || scene.publication === 'draft') return response.status(404).json({ error: 'Scene not found.' })
  const user = await User.findByIdAndUpdate(request.user._id, { $addToSet: { savedScenes: scene._id } }, { new: true })
  response.json({ savedSceneIds: (user.savedScenes || []).map(String) })
})
app.delete('/api/scenes/:sceneId/save', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const user = await User.findByIdAndUpdate(request.user._id, { $pull: { savedScenes: request.params.sceneId } }, { new: true })
  response.json({ savedSceneIds: (user.savedScenes || []).map(String) })
})
app.get('/api/scenes/:sceneId/pass', requireUser, async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId).lean()
  if (!scene || scene.publication === 'draft' || !scene.members.includes(actor(request))) return response.status(403).json({ error: 'A confirmed reservation is required to view this pass.' })
  if (scene.price > 0 || scene.paymentRequired) return response.status(409).json({ error: 'Paid passes require a verified payment provider.' })
  const reference = 'SCN-' + createHmac('sha256', authSecret).update(`pass:${scene._id}:${request.user._id}`).digest('hex').slice(0, 12).toUpperCase()
  response.json({ reference, attendee: request.user.displayName || actor(request), username: actor(request), quantity: 1, admission: 'Free admission', status: scene.status === 'cancelled' ? 'CANCELLED' : sceneStatus(scene) === 'ENDED' ? 'ENDED' : 'CONFIRMED', scene: sceneView(scene, request) })
})
app.post('/api/scenes', requireUser, async (request, response) => {
  const publish = request.body?.publication !== 'draft'; const parsed = parseScene(request.body || {}, publish)
  if (parsed.error) return response.status(400).json({ error: parsed.error })
  const scene = await Scene.create({ ...parsed.data, host: actor(request), hostId: request.user._id, publication: publish ? 'published' : 'draft', joined: 1, members: [actor(request)] })
  response.status(201).json(sceneView(scene, request))
})
app.patch('/api/scenes/:sceneId', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene) return response.status(404).json({ error: 'Scene not found.' })
  if (scene.hostId?.toString() !== request.user._id.toString() && scene.host !== actor(request)) return response.status(403).json({ error: 'Only the host can edit this Scene.' })
  if (scene.status === 'cancelled') return response.status(409).json({ error: 'A cancelled Scene cannot be edited.' })
  const merged = { ...scene.toObject(), ...request.body }; const publish = merged.publication !== 'draft'; const parsed = parseScene(merged, publish)
  if (parsed.error) return response.status(400).json({ error: parsed.error })
  if (parsed.data.capacity < scene.joined) return response.status(409).json({ error: 'Capacity cannot be below confirmed attendance.' })
  Object.assign(scene, parsed.data, { publication: publish ? 'published' : 'draft' }); await scene.save()
  response.json(sceneView(scene, request))
})
app.post('/api/scenes/:sceneId/cancel', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene) return response.status(404).json({ error: 'Scene not found.' })
  if (scene.hostId?.toString() !== request.user._id.toString() && scene.host !== actor(request)) return response.status(403).json({ error: 'Only the host can cancel this Scene.' })
  scene.status = 'cancelled'; await scene.save(); response.json(sceneView(scene, request))
})
app.post('/api/scenes/:sceneId/live', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene) return response.status(404).json({ error: 'Scene not found.' })
  if (scene.hostId?.toString() !== request.user._id.toString() && scene.host !== actor(request)) return response.status(403).json({ error: 'Only the host can confirm a Scene is live.' })
  const now = new Date()
  if (scene.status === 'cancelled' || scene.publication === 'draft' || !scene.startsAt || !scene.endsAtDate || scene.startsAt > now || scene.endsAtDate <= now) return response.status(409).json({ error: 'This Scene is not in progress.' })
  scene.liveConfirmed = true; await scene.save(); response.json(sceneView(scene, request))
})
app.get('/api/bookings', requireUser, async (request, response) => response.json(await Booking.find({ userName: actor(request) }).sort({ createdAt: -1 }).limit(50).lean()))
app.post('/api/scenes/:sceneId/book', requireUser, (_request, response) => response.status(409).json({ error: 'Paid bookings are unavailable until a verified payment provider is connected. Free Scenes use Join.' }))
app.post('/api/scenes/:sceneId/join', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene || !sceneAccess(scene, request) || scene.status !== 'open' || scene.publication === 'draft') return response.status(404).json({ error: 'Scene not found.' })
  if (scene.endsAtDate && scene.endsAtDate <= new Date()) return response.status(409).json({ error: 'This Scene has ended.' })
  if (scene.registrationDeadline && scene.registrationDeadline <= new Date()) return response.status(409).json({ error: 'Registration has closed.' })
  if (scene.paymentRequired || scene.price > 0) return response.status(409).json({ error: 'Paid registration is not available yet.' })
  const userName = actor(request)
  if (scene.members.includes(userName)) return response.json({ status: 'JOINED', scene: sceneView(scene, request) })
  if (scene.joined >= scene.capacity) return response.status(409).json({ error: 'This Scene is full.' })
  if (scene.joinType === 'approval') {
    const updated = await Scene.findOneAndUpdate({ _id: scene._id, members: { $ne: userName }, requests: { $not: { $elemMatch: { userName, status: 'PENDING' } } } }, { $push: { requests: { userName, status: 'PENDING' } } }, { new: true })
    return response.status(202).json({ status: 'PENDING', scene: sceneView(updated || scene, request) })
  }
  const updated = await Scene.findOneAndUpdate({ _id: scene._id, status: 'open', members: { $ne: userName }, $expr: { $lt: ['$joined', '$capacity'] } }, { $inc: { joined: 1 }, $addToSet: { members: userName } }, { new: true })
  if (!updated) { const current = await Scene.findById(scene._id); return response.status(409).json({ error: current?.members.includes(userName) ? 'You have already joined.' : 'This Scene is full.' }) }
  response.json({ status: 'JOINED', scene: sceneView(updated, request) })
})
app.get('/api/scenes/:sceneId/requests', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene) return response.status(404).json({ error: 'Scene not found.' })
  if (scene.hostId?.toString() !== request.user._id.toString() && scene.host !== actor(request)) return response.status(403).json({ error: 'Only the host can view join requests.' })
  response.json(scene.requests.map((item) => ({ id: item._id, username: item.userName, status: item.status, createdAt: item.createdAt })))
})
app.post('/api/scenes/:sceneId/requests/:requestId', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId) || !mongoose.isValidObjectId(request.params.requestId)) return response.status(404).json({ error: 'Request not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene) return response.status(404).json({ error: 'Scene not found.' })
  if (scene.hostId?.toString() !== request.user._id.toString() && scene.host !== actor(request)) return response.status(403).json({ error: 'Only the host can manage join requests.' })
  const decision = request.body?.decision
  if (!['APPROVED', 'REJECTED'].includes(decision)) return response.status(400).json({ error: 'Choose approve or reject.' })
  const item = scene.requests.id(request.params.requestId)
  if (!item || item.status !== 'PENDING') return response.status(409).json({ error: 'This request is no longer pending.' })
  if (decision === 'APPROVED' && (scene.status === 'cancelled' || scene.publication === 'draft' || scene.endsAtDate && scene.endsAtDate <= new Date() || scene.registrationDeadline && scene.registrationDeadline <= new Date() || scene.price > 0 || scene.paymentRequired)) return response.status(409).json({ error: 'Registration is closed for this Scene.' })
  const filter = { _id: scene._id, requests: { $elemMatch: { _id: item._id, status: 'PENDING' } } }
  if (decision === 'APPROVED') { filter.members = { $ne: item.userName }; filter.$expr = { $lt: ['$joined', '$capacity'] } }
  const update = decision === 'APPROVED' ? { $set: { 'requests.$[pending].status': decision }, $inc: { joined: 1 }, $addToSet: { members: item.userName } } : { $set: { 'requests.$[pending].status': decision } }
  const updated = await Scene.findOneAndUpdate(filter, update, { new: true, arrayFilters: [{ 'pending._id': item._id, 'pending.status': 'PENDING' }] })
  if (!updated) return response.status(409).json({ error: 'The request changed or the Scene is full.' })
  response.json({ status: decision, scene: sceneView(updated, request) })
})
app.post('/api/scenes/:sceneId/leave', requireUser, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) return response.status(404).json({ error: 'Scene not found.' })
  const scene = await Scene.findById(request.params.sceneId)
  if (!scene) return response.status(404).json({ error: 'Scene not found.' })
  if (scene.host === actor(request)) return response.status(409).json({ error: 'The host cannot leave their own Scene.' })
  const updated = await Scene.findOneAndUpdate({ _id: scene._id, members: actor(request) }, { $pull: { members: actor(request) }, $inc: { joined: -1 } }, { new: true })
  if (!updated) return response.status(409).json({ error: 'You are not attending this Scene.' })
  response.json(sceneView(updated, request))
})
const chatScene = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.sceneId)) { response.status(404).json({ error: 'Scene not found.' }); return null }
  const scene = await Scene.findById(request.params.sceneId).lean()
  if (!scene || !scene.members.includes(actor(request))) { response.status(403).json({ error: 'Join this Scene to access its chat.' }); return null }
  return scene
}
app.get('/api/scenes/:sceneId/messages', requireUser, async (request, response) => {
  if (!await chatScene(request, response)) return
  const before = request.query.before && mongoose.isValidObjectId(request.query.before) ? { _id: { $lt: request.query.before } } : {}
  const messages = await Message.find({ sceneId: request.params.sceneId, ...before }).sort({ _id: -1 }).limit(50).lean()
  response.json(messages.reverse())
})
app.post('/api/scenes/:sceneId/messages', requireUser, async (request, response) => {
  if (!await chatScene(request, response)) return
  const text = cleanText(request.body?.text, 2000)
  if (!text) return response.status(400).json({ error: 'Message must be between 1 and 2000 characters.' })
  response.status(201).json(await Message.create({ sceneId: request.params.sceneId, sender: actor(request), text }))
})
app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found.' }))
app.use((error, _request, response, _next) => { if (error?.status === 413) return response.status(413).json({ error: 'Image must be under 3 MB.' }); console.error('API request failed:', error.name); response.status(500).json({ error: 'Something went wrong.' }) })

export default app
