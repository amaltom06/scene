import 'dotenv/config'
import mongoose from 'mongoose'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { eventCategories } from '../shared/events.js'
import { FriendRequest, Message, Post, Scene, User } from './models.js'
import { buildDemoData } from './demo-data.js'
import { writeDemoAvatars } from './demo-avatars.js'

const namespace = 'scene-demo-v1:'
const scrypt = promisify(scryptCallback)
const groupModels = { users: User, scenes: Scene, posts: Post, messages: Message, friendships: FriendRequest }
const keyFor = (group, item) => namespace + group + ':' + item.demoKey

export function assertDemoTarget(mongoUri, environment = process.env.NODE_ENV) {
  if (environment === 'production') throw new Error('Demo seeding is disabled in production.')
  let target
  try { target = new URL(mongoUri) } catch { throw new Error('Use a local MongoDB URI for demo data.') }
  if (target.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Demo seeding only supports a local MongoDB database.')
  let database
  try { database = decodeURIComponent(target.pathname.slice(1)) } catch { throw new Error('Choose a valid application database for demo data.') }
  if (!database || /[\/\\\s]/.test(database) || ['admin', 'config', 'local'].includes(database.toLowerCase())) throw new Error('Choose a named application database for demo data.')
}

const fail = (condition, message) => { if (!condition) throw new Error('Invalid demo data: ' + message) }
const unique = (items) => new Set(items).size === items.length
const validDate = (value) => value != null && Number.isFinite(new Date(value).getTime())
const imageUrl = (value) => typeof value === 'string' && /^https:\/\//.test(value)

export function validateDemoData(data) {
  for (const group of Object.keys(groupModels)) {
    fail(Array.isArray(data[group]), group + ' must be an array.')
    fail(data[group].every((item) => typeof item.demoKey === 'string' && item.demoKey.length > 0), group + ' needs stable keys.')
    fail(unique(data[group].map((item) => item.demoKey)), group + ' keys must be unique.')
  }
  const users = new Map(data.users.map((user) => [user.username, user]))
  const scenes = new Map(data.scenes.map((scene) => [scene.demoKey, scene]))
  fail(unique(data.users.map((user) => user.username)) && unique(data.users.map((user) => user.email)), 'profiles must have unique usernames and emails.')
  for (const user of data.users) {
    fail(/^demo_[a-z0-9_]{1,25}$/.test(user.username), 'demo usernames must be valid and use the demo_ prefix.')
    fail(user.email === user.username + '@demo.scene.test', 'demo emails must use reserved .test addresses.')
    fail(user.bio?.includes('Demo profile.'), 'profiles must be labelled as demo content.')
    fail(user.interests?.every((item) => eventCategories.includes(item)), 'profile interests must use supported categories.')
    for (const key of user.savedSceneKeys || []) {
      const scene = scenes.get(key)
      fail(scene && scene.publication !== 'draft' && (scene.visibility !== 'private' || scene.memberUsernames.includes(user.username)), 'saved events must be accessible to their profile.')
    }
  }
  for (const scene of data.scenes) {
    fail(users.has(scene.hostUsername), 'each event host must resolve to a demo profile.')
    fail(eventCategories.includes(scene.category), 'each event needs a supported category.')
    fail(scene.description?.startsWith('Demo event.') || scene.title?.includes('(Demo)'), 'events must be labelled as demo content.')
    fail(Array.isArray(scene.memberUsernames) && unique(scene.memberUsernames), 'members must be unique.')
    fail(scene.memberUsernames.includes(scene.hostUsername) && scene.memberUsernames.every((name) => users.has(name)), 'the host and all members must resolve to demo profiles.')
    fail(Number.isInteger(scene.capacity) && scene.capacity >= 2 && scene.capacity <= 1000 && scene.memberUsernames.length <= scene.capacity, 'attendance must fit event capacity.')
    fail(validDate(scene.startsAt) && validDate(scene.endsAtDate) && new Date(scene.startsAt) < new Date(scene.endsAtDate), 'events need an ordered valid schedule.')
    fail(!scene.registrationDeadline || validDate(scene.registrationDeadline) && new Date(scene.registrationDeadline) < new Date(scene.startsAt), 'registration deadlines must precede event starts.')
    fail(scene.timezone === 'Asia/Kolkata', 'use the India timezone.')
    fail(Number.isFinite(scene.latitude) && Number.isFinite(scene.longitude) && scene.latitude >= -90 && scene.latitude <= 90 && scene.longitude >= -180 && scene.longitude <= 180, 'events need valid map coordinates.')
    fail(imageUrl(scene.image), 'event cover images must use HTTPS.')
    fail(!scene.price && !scene.paymentRequired, 'demo reservations must be free.')
    const requests = scene.requests || []
    fail(unique(requests.map((request) => request.userName)), 'join requests must be unique per event.')
    for (const request of requests) {
      fail(users.has(request.userName) && ['PENDING', 'APPROVED', 'REJECTED'].includes(request.status), 'join requests must resolve to profiles and valid states.')
      fail(request.status !== 'PENDING' || !scene.memberUsernames.includes(request.userName), 'pending applicants cannot already be members.')
      fail(request.status !== 'APPROVED' || scene.memberUsernames.includes(request.userName), 'approved guests must be members.')
    }
  }
  for (const post of data.posts) {
    const scene = scenes.get(post.sceneKey)
    fail(users.has(post.author) && scene && scene.city === post.city, 'post authors and event cities must resolve.')
    fail(post.mediaType === 'image' && imageUrl(post.mediaUrl), 'demo posts need HTTPS image media.')
    fail((post.likesUsernames || []).every((name) => users.has(name)) && unique(post.likesUsernames || []), 'post likes must resolve to unique profiles.')
  }
  for (const message of data.messages) {
    const scene = scenes.get(message.sceneKey)
    fail(scene && scene.memberUsernames.includes(message.sender), 'chat senders must be confirmed event members.')
    fail(validDate(message.createdAt), 'chat messages need valid timestamps.')
  }
  const pairs = []
  for (const friendship of data.friendships) {
    fail(users.has(friendship.requester) && users.has(friendship.recipient) && friendship.requester !== friendship.recipient, 'friendship endpoints must resolve to distinct profiles.')
    pairs.push([friendship.requester, friendship.recipient].sort().join(':'))
  }
  fail(unique(pairs), 'friendship pairs must be unique.')
}

export async function seedDemoData({ mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scene', now = new Date(), password = process.env.DEMO_PASSWORD || 'SceneDemo!2026', fixtures = buildDemoData({ now }) } = {}) {
  assertDemoTarget(mongoUri)
  fail(validDate(now), 'the reference time must be valid.')
  fail(typeof password === 'string' && password.length >= 8 && password.length <= 128, 'the demo password needs 8–128 characters.')
  validateDemoData(fixtures)
  const connection = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000, directConnection: true }).asPromise()
  try {
    const models = Object.fromEntries(Object.entries(groupModels).map(([group, model]) => [group, connection.model(model.modelName, model.schema)]))
    const existing = {}
    for (const group of Object.keys(models)) {
      existing[group] = await models[group].find({ demoKey: { $in: fixtures[group].map((item) => keyFor(group, item)) } }).select('_id demoKey isDemo').lean()
      fail(existing[group].every((item) => item.isDemo), 'a demo key conflicts with a non-demo record. No data was overwritten.')
    }
    const clashes = await models.users.find({ $or: [{ username: { $in: fixtures.users.map((user) => user.username) } }, { email: { $in: fixtures.users.map((user) => user.email) } }] }).select('username email demoKey isDemo').lean()
    for (const user of fixtures.users) {
      fail(!clashes.some((other) => (other.username === user.username || other.email === user.email) && (!other.isDemo || other.demoKey !== keyFor('users', user))), 'a demo username or email is already used by another account. No data was overwritten.')
    }
    const ids = {}
    for (const group of Object.keys(models)) {
      const current = new Map(existing[group].map((item) => [item.demoKey, item._id]))
      const records = group === 'messages' ? [...fixtures[group]].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) : fixtures[group]
      ids[group] = new Map(records.map((item) => [item.demoKey, current.get(keyFor(group, item)) || new mongoose.Types.ObjectId()]))
    }
    const userIds = new Map(fixtures.users.map((user) => [user.username, ids.users.get(user.demoKey)]))
    const sceneByKey = new Map(fixtures.scenes.map((scene) => [scene.demoKey, scene]))
    const salt = randomBytes(16).toString('hex')
    const hash = (await scrypt(password, salt, 64)).toString('hex')
    const metadata = (group, item, index) => ({ _id: ids[group].get(item.demoKey), demoKey: keyFor(group, item), isDemo: true, createdAt: item.createdAt || new Date(new Date(now).getTime() - (fixtures[group].length - index) * 3600000), updatedAt: now })
    const documents = {
      users: fixtures.users.map((user, index) => ({ ...user, ...metadata('users', user, index), onboarded: true, emailVerified: false, privateAccount: false, shareAttendance: false, savedScenes: (user.savedSceneKeys || []).map((key) => ids.scenes.get(key)), passwordSalt: user.username === 'demo_aarav' ? salt : '', passwordHash: user.username === 'demo_aarav' ? hash : '' })),
      scenes: fixtures.scenes.map((scene, index) => ({ ...scene, ...metadata('scenes', scene, index), host: scene.hostUsername, hostId: userIds.get(scene.hostUsername), members: scene.memberUsernames, joined: scene.memberUsernames.length, locationType: scene.locationType || 'in_person', location: { type: 'Point', coordinates: [scene.longitude, scene.latitude] }, date: new Intl.DateTimeFormat('en-IN', { timeZone: scene.timezone, dateStyle: 'medium' }).format(new Date(scene.startsAt)), time: new Intl.DateTimeFormat('en-IN', { timeZone: scene.timezone, timeStyle: 'short' }).format(new Date(scene.startsAt)), price: 0, paymentRequired: false, currency: 'INR' })),
      posts: fixtures.posts.map((post, index) => ({ ...post, ...metadata('posts', post, index), eventTitle: sceneByKey.get(post.sceneKey).title, likes: post.likesUsernames || [] })),
      messages: fixtures.messages.map((message, index) => ({ ...message, ...metadata('messages', message, index), sceneId: ids.scenes.get(message.sceneKey) })),
      friendships: fixtures.friendships.map((friendship, index) => ({ ...friendship, ...metadata('friendships', friendship, index) })),
    }
    const validated = {}
    for (const group of Object.keys(models)) {
      validated[group] = await Promise.all(documents[group].map(async (data) => { const document = new models[group](data); await document.validate(); return document.toObject() }))
    }
    // All documents and graph references are checked before inserting any records.
    await Promise.all(Object.values(models).map((model) => model.init()))
    const inserted = {}; const totals = {}
    for (const group of Object.keys(models)) {
      const result = await models[group].bulkWrite(validated[group].map((document) => ({ updateOne: { filter: { demoKey: document.demoKey, isDemo: true }, update: { $setOnInsert: document }, upsert: true, timestamps: false } })), { timestamps: false })
      inserted[group] = result.upsertedCount
      totals[group] = await models[group].countDocuments({ demoKey: { $in: validated[group].map((document) => document.demoKey) }, isDemo: true })
    }
    return { inserted, totals }
  } finally { await connection.close() }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const now = new Date()
    const fixtures = buildDemoData({ now })
    const result = await seedDemoData({ now, fixtures })
    await writeDemoAvatars(fixtures.users, path.resolve('public/demo/avatars'))
    console.log('Demo community ready. Existing records and interactions were preserved.')
    console.log(JSON.stringify(result, null, 2))
    console.log('Demo login: demo_aarav@demo.scene.test')
    console.log(process.env.DEMO_PASSWORD ? 'Password: your configured DEMO_PASSWORD' : 'Password: SceneDemo!2026')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
