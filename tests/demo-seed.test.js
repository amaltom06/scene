import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import mongoose from 'mongoose'
import { buildDemoData } from '../server/demo-data.js'
import { assertDemoTarget, seedDemoData } from '../server/seed-demo.js'
import { eventCategories } from '../shared/events.js'

const collections = { users: 'users', scenes: 'scenes', posts: 'posts', messages: 'messages', friendships: 'friendrequests' }
const fixtureCounts = (fixtures) => Object.fromEntries(Object.keys(collections).map((key) => [key, fixtures[key].length]))
const freePort = () => new Promise((resolve, reject) => {
  const probe = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const port = probe.address().port
    probe.close(() => resolve(port))
  })
})
const readDemoRecords = async (connection) => Object.fromEntries(await Promise.all(
  Object.entries(collections).map(async ([key, name]) => [key, await connection.collection(name).find({ isDemo: true }).sort({ _id: 1 }).toArray()]),
))

test('demo seed accepts only local application databases outside production', () => {
  assert.doesNotThrow(() => assertDemoTarget('mongodb://127.0.0.1:27017/scene_demo_test_local', 'test'))
  assert.doesNotThrow(() => assertDemoTarget('mongodb://localhost:27017/scene', 'development'))
  for (const uri of [
    'mongodb://example.com:27017/scene',
    'mongodb+srv://example.com/scene',
    'mongodb://127.0.0.1:27017,example.com:27017/scene',
    'mongodb://127.0.0.1:27017/admin',
    'mongodb://127.0.0.1:27017/config',
    'mongodb://127.0.0.1:27017/local',
    'mongodb://127.0.0.1:27017/%61dmin',
    'mongodb://127.0.0.1:27017/%63onfig',
    'mongodb://127.0.0.1:27017/%6cocal',
    'mongodb://127.0.0.1:27017/',
  ]) assert.throws(() => assertDemoTarget(uri, 'test'), uri)
  assert.throws(() => assertDemoTarget('mongodb://127.0.0.1:27017/scene', 'production'))
})

test('demo seed validates its graph, supports the API walkthrough, and preserves data on reruns', { timeout: 60000 }, async () => {
  const database = `scene_demo_test_${randomBytes(8).toString('hex')}`
  const mongoUri = `mongodb://127.0.0.1:27017/${database}`
  const connection = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise()
  const now = new Date()
  const fixtures = buildDemoData({ now })
  const expected = fixtureCounts(fixtures)
  const loginEmail = 'demo_aarav@demo.scene.test'
  const password = 'SceneDemo!2026'
  let server
  try {
    const invalid = structuredClone(fixtures)
    invalid.scenes[0].memberUsernames.push('missing_demo_person')
    await assert.rejects(seedDemoData({ mongoUri, now, password, fixtures: invalid }))
    for (const name of Object.values(collections)) assert.equal(await connection.collection(name).countDocuments(), 0, `${name} must stay empty after validation fails`)

    const conflictingUser = { _id: new mongoose.Types.ObjectId(), username: fixtures.users[0].username, email: fixtures.users[0].email, bio: 'This existing account is not demo data.' }
    await connection.collection('users').insertOne(conflictingUser)
    await assert.rejects(seedDemoData({ mongoUri, now, password, fixtures }), /already used|conflict/i)
    assert.deepEqual(await connection.collection('users').findOne({ _id: conflictingUser._id }), conflictingUser, 'a colliding real account must remain untouched')
    assert.equal(await connection.collection('users').countDocuments(), 1)
    for (const name of Object.values(collections).filter((name) => name !== 'users')) assert.equal(await connection.collection(name).countDocuments(), 0, 'a username collision must prevent all inserts')
    await connection.collection('users').deleteOne({ _id: conflictingUser._id })

    const sentinel = {
      _id: new mongoose.Types.ObjectId(), username: 'existing_visitor', email: 'existing_visitor@example.test',
      displayName: 'Existing Visitor', bio: 'Keep my real profile intact.', city: 'Kochi',
      savedScenes: [], createdAt: new Date(now.getTime() - 86400000), updatedAt: new Date(now.getTime() - 86400000),
    }
    await connection.collection('users').insertOne(sentinel)
    const seeded = await seedDemoData({ mongoUri, now, password, fixtures })
    assert.deepEqual(seeded.inserted, expected)
    assert.deepEqual(seeded.totals, expected)
    const records = await readDemoRecords(connection)
    for (const [key, list] of Object.entries(records)) {
      assert.equal(list.length, expected[key], `${key} count`)
      assert.equal(new Set(list.map((document) => document.demoKey)).size, list.length, `${key} demo keys must be unique`)
      assert.ok(list.every((document) => document.isDemo && typeof document.demoKey === 'string' && document.demoKey.length > 0))
    }
    assert.equal(await connection.collection('users').countDocuments(), expected.users + 1)
    const usersByName = new Map(records.users.map((user) => [user.username, user]))
    const usersById = new Map(records.users.map((user) => [String(user._id), user]))
    const scenesById = new Map(records.scenes.map((scene) => [String(scene._id), scene]))
    const aarav = records.users.find((user) => user.email === loginEmail)
    assert.ok(aarav, 'the walkthrough account must exist')
    assert.ok(aarav.passwordHash && aarav.passwordSalt, 'the walkthrough password must be hashed')
    assert.ok(records.users.every((user) => /^[a-z0-9_]{2,30}$/.test(user.username) && user.email.endsWith('@demo.scene.test')))
    assert.ok(records.users.filter((user) => user._id.toString() !== aarav._id.toString()).every((user) => !user.passwordHash && !user.googleId), 'other fictional profiles must be login locked')
    for (const user of records.users) for (const id of user.savedScenes) assert.ok(scenesById.has(String(id)), 'saved Scene must resolve')
    for (const scene of records.scenes) {
      assert.ok(eventCategories.includes(scene.category), `supported category: ${scene.category}`)
      assert.equal(usersById.get(String(scene.hostId))?.username, scene.host, 'host identity must resolve')
      assert.ok(scene.members.includes(scene.host), 'host must be a member')
      assert.equal(new Set(scene.members).size, scene.members.length, 'members must be unique')
      assert.equal(scene.joined, scene.members.length, 'displayed attendance must match members')
      assert.ok(Number.isInteger(scene.capacity) && scene.capacity >= 2 && scene.capacity <= 1000 && scene.joined <= scene.capacity)
      assert.equal(scene.price, 0)
      assert.equal(scene.paymentRequired, false)
      assert.ok(new Date(scene.startsAt) < new Date(scene.endsAtDate), 'a Scene must end after it starts')
      if (scene.registrationDeadline) assert.ok(new Date(scene.registrationDeadline) < new Date(scene.startsAt))
      for (const member of scene.members) assert.ok(usersByName.has(member), `member ${member} must resolve`)
      for (const request of scene.requests) {
        assert.ok(usersByName.has(request.userName), 'requester must resolve')
        if (request.status === 'PENDING') assert.ok(!scene.members.includes(request.userName), 'pending requests must not count as attendance')
        if (request.status === 'APPROVED') assert.ok(scene.members.includes(request.userName), 'approved requests must count as attendance')
      }
      if (scene.location?.coordinates?.length) {
        assert.equal(scene.location.type, 'Point')
        assert.deepEqual(scene.location.coordinates, [scene.longitude, scene.latitude])
      }
    }
    for (const post of records.posts) {
      assert.ok(usersByName.has(post.author), 'post author must resolve')
      assert.match(post.mediaUrl, /^https:\/\//)
      assert.equal(new Set(post.likes).size, post.likes.length, 'likes must be unique')
      assert.ok(post.likes.every((name) => usersByName.has(name)), 'post likes must resolve')
    }
    for (const message of records.messages) {
      const scene = scenesById.get(String(message.sceneId))
      assert.ok(scene, 'message Scene must resolve')
      assert.ok(scene.members.includes(message.sender), 'chat sender must be a confirmed attendee')
      assert.ok(message.text.trim())
    }
    const friendshipPairs = new Set()
    for (const friendship of records.friendships) {
      assert.ok(usersByName.has(friendship.requester) && usersByName.has(friendship.recipient))
      assert.notEqual(friendship.requester, friendship.recipient)
      const pair = [friendship.requester, friendship.recipient].sort().join(':')
      assert.ok(!friendshipPairs.has(pair), 'friendship pair must be unique')
      friendshipPairs.add(pair)
    }

    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, ['server/index.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port), MONGODB_URI: mongoUri, AUTH_SECRET: randomBytes(48).toString('hex'), CORS_ORIGIN: base, NODE_ENV: 'test', RESEND_API_KEY: '', EMAIL_FROM: '', PUBLIC_APP_URL: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let logs = ''
    server.stdout.on('data', (chunk) => { logs += chunk })
    server.stderr.on('data', (chunk) => { logs += chunk })
    const api = async (path, { method = 'GET', cookie, body } = {}) => {
      const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
      return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], total: Number(response.headers.get('x-total')), data: response.status === 204 ? null : await response.json() }
    }
    let ready = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { if ((await api('/api/health')).data.database === 'connected') { ready = true; break } } catch { /* API is starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert.ok(ready, `Seeded test API failed to start: ${logs}`)
    const publicKochi = await api('/api/scenes?city=Kochi&limit=50')
    const visibleKochi = records.scenes.filter((scene) => scene.city === 'Kochi' && scene.status !== 'cancelled' && scene.publication !== 'draft' && !['private', 'unlisted'].includes(scene.visibility) && new Date(scene.endsAtDate) > new Date())
    assert.equal(publicKochi.status, 200)
    assert.ok(visibleKochi.length > 0)
    assert.equal(publicKochi.total, visibleKochi.length)
    assert.ok(publicKochi.data.every((scene) => scene.members.length === 0 && !('requests' in scene)), 'public discovery must hide member names and requests')
    const login = await api('/api/auth/login', { method: 'POST', body: { email: loginEmail, password } })
    assert.equal(login.status, 200, JSON.stringify(login.data))
    assert.equal(login.data.user.username, aarav.username)
    assert.ok(login.cookie)
    const cookie = login.cookie
    const me = await api('/api/auth/me', { cookie })
    assert.equal(me.data.user.displayName, aarav.displayName)
    assert.equal(me.data.user.onboarded, true)
    const locked = records.users.find((user) => !user.passwordHash)
    assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: locked.email, password } })).status, 401)
    const plans = {}
    for (const filter of ['participating', 'saved', 'requested', 'mine']) {
      const result = await api(`/api/scenes?${filter}=1&limit=50`, { cookie })
      assert.equal(result.status, 200)
      assert.ok(result.data.length > 0, `${filter} walkthrough must be populated`)
      plans[filter] = result.data
    }
    const withChat = plans.participating.find((scene) => scene.publication === 'published' && scene.status !== 'cancelled' && new Date(scene.endsAtDate) > new Date() && records.messages.some((message) => String(message.sceneId) === scene._id))
    assert.ok(withChat, 'a confirmed future Scene must have seeded chat')
    const pass = await api(`/api/scenes/${withChat._id}/pass`, { cookie })
    assert.equal(pass.status, 200)
    assert.equal(pass.data.status, 'CONFIRMED')
    assert.match(pass.data.reference, /^SCN-[A-F0-9]{12}$/)
    const chat = await api(`/api/scenes/${withChat._id}/messages`, { cookie })
    assert.equal(chat.status, 200)
    assert.ok(chat.data.length > 0)
    const notJoined = records.scenes.find((scene) => scene.publication === 'published' && scene.visibility === 'public' && !scene.members.includes(aarav.username))
    assert.ok(notJoined)
    assert.equal((await api(`/api/scenes/${notJoined._id}/messages`, { cookie })).status, 403)
    assert.equal((await api(`/api/scenes/${notJoined._id}/pass`, { cookie })).status, 403)
    const nearby = await api('/api/scenes/nearby?latitude=9.9312&longitude=76.2673&km=30')
    assert.equal(nearby.status, 200, JSON.stringify(nearby.data))
    assert.ok(nearby.data.length > 0)
    assert.equal((await api('/api/people', { cookie })).status, 200)
    assert.ok((await api('/api/posts?city=Kochi', { cookie })).data.length > 0)

    const joinable = records.scenes.find((scene) => scene.publication === 'published' && scene.visibility === 'public' && scene.status === 'open' && scene.joinType === 'open' && !scene.members.includes(aarav.username) && scene.joined < scene.capacity && new Date(scene.endsAtDate) > new Date() && (!scene.registrationDeadline || new Date(scene.registrationDeadline) > new Date()))
    assert.ok(joinable, 'a demo visitor must have an available open event to join')
    const joined = await api(`/api/scenes/${joinable._id}/join`, { method: 'POST', cookie })
    assert.equal(joined.status, 200)
    assert.equal(joined.data.status, 'JOINED')
    assert.equal(joined.data.scene.joined, joinable.joined + 1)
    const incomingFriend = records.friendships.find((friendship) => friendship.recipient === aarav.username && friendship.status === 'PENDING')
    assert.ok(incomingFriend, 'the walkthrough must include an incoming friend request')
    const accepted = await api('/api/friends/request', { method: 'POST', cookie, body: { recipient: incomingFriend.requester } })
    assert.equal(accepted.status, 200)
    assert.equal(accepted.data.status, 'ACCEPTED')
    const hostedApproval = plans.mine.find((scene) => scene.pendingRequests > 0 && scene.publication === 'published' && scene.status === 'open' && new Date(scene.endsAtDate) > new Date())
    assert.ok(hostedApproval, 'the host walkthrough must include pending attendance requests')
    const requests = await api(`/api/scenes/${hostedApproval._id}/requests`, { cookie })
    assert.equal(requests.status, 200)
    const pending = requests.data.find((request) => request.status === 'PENDING')
    assert.ok(pending)
    const approved = await api(`/api/scenes/${hostedApproval._id}/requests/${pending.id}`, { method: 'POST', cookie, body: { decision: 'APPROVED' } })
    assert.equal(approved.status, 200)
    assert.equal(approved.data.status, 'APPROVED')
    assert.ok(approved.data.scene.members.includes(pending.username))
    assert.equal(approved.data.scene.joined, hostedApproval.joined + 1)

    await connection.collection('users').updateOne({ _id: aarav._id }, { $set: { bio: 'Edited during the demo walkthrough.', savedScenes: [] } })
    await connection.collection('posts').updateOne({ _id: records.posts[0]._id }, { $set: { caption: 'Visitor edited this moment.', likes: [sentinel.username] } })
    const beforeRerun = await readDemoRecords(connection)
    const rerun = await seedDemoData({ mongoUri, now, password, fixtures })
    assert.deepEqual(rerun.inserted, Object.fromEntries(Object.keys(collections).map((key) => [key, 0])))
    assert.deepEqual(rerun.totals, expected)
    assert.deepEqual(await readDemoRecords(connection), beforeRerun, 'rerunning must preserve all demo content, interactions, IDs, and timestamps')
    assert.deepEqual(await connection.collection('users').findOne({ _id: sentinel._id }), sentinel, 'existing non-demo data must remain untouched')
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve))
      server.kill('SIGTERM')
      await exited
    }
    assert.match(connection.name, /^scene_demo_test_[a-f0-9]{16}$/, 'cleanup is restricted to this disposable database')
    try { await connection.dropDatabase() } finally { await connection.close() }
  }
})
