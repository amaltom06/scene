import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import mongoose from 'mongoose'
import { deploymentConfig } from '../server/config.js'
import { assertHostedDemoTarget } from '../server/seed-demo.js'

test('deployment requires secrets and allows only configured project origins', () => {
  assert.throws(() => deploymentConfig({ NODE_ENV: 'production' }), /AUTH_SECRET/)
  assert.throws(() => deploymentConfig({ NODE_ENV: 'production', AUTH_SECRET: 'a'.repeat(48) }), /MONGODB_URI/)
  const config = deploymentConfig({
    NODE_ENV: 'production', AUTH_SECRET: randomBytes(48).toString('hex'), MONGODB_URI: 'mongodb://localhost/scene',
    VERCEL_URL: 'scene-preview.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'scene.vercel.app',
    PUBLIC_APP_URL: 'https://scene.example.com', CORS_ORIGIN: 'https://scene.example.com/',
  })
  assert.equal(config.secureCookie, true)
  assert.deepEqual(config.allowedOrigins, ['https://scene.example.com', 'https://scene-preview.vercel.app', 'https://scene.vercel.app'])
  assert.ok(!config.allowedOrigins.includes('https://other.vercel.app'))
  assert.throws(() => deploymentConfig({ CORS_ORIGIN: 'https://scene.example.com/path' }), /origin/)
})

test('hosted seed is limited to an authenticated Atlas scene_demo database', () => {
  assert.doesNotThrow(() => assertHostedDemoTarget('mongodb+srv://user:password@cluster.example.mongodb.net/scene_demo?retryWrites=true&w=majority'))
  for (const uri of [undefined, 'mongodb://localhost/scene_demo', 'mongodb+srv://user:password@cluster.mongodb.net/scene',
    'mongodb+srv://user:password@cluster.mongodb.net/admin', 'mongodb+srv://cluster.mongodb.net/scene_demo',
    'mongodb+srv://user:password@mongodb.net.attacker.test/scene_demo']) {
    assert.throws(() => assertHostedDemoTarget(uri))
  }
})

test('Vercel handler supports secure sessions, JSON, durable photos and API routing', async () => {
  const database = 'scene_test_deployment_' + randomBytes(6).toString('hex')
  const environment = {
    NODE_ENV: 'production', VERCEL: '1', MONGODB_URI: 'mongodb://127.0.0.1:27017/' + database,
    AUTH_SECRET: randomBytes(48).toString('hex'), AVATAR_STORAGE: 'mongodb',
    VERCEL_URL: 'scene-preview.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'scene-test.vercel.app',
    VERCEL_BRANCH_URL: '', CORS_ORIGIN: '', PUBLIC_APP_URL: '', RESEND_API_KEY: '', EMAIL_FROM: '',
  }
  const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]))
  Object.assign(process.env, environment)
  let server
  try {
    const { default: handler } = await import('../api/index.js')
    // Vercel recognizes Express exports and leaves request streams untouched.
    assert.equal(typeof handler.listen, 'function')
    server = createServer(handler)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = 'http://127.0.0.1:' + server.address().port
    const origin = 'https://scene-test.vercel.app'
    const health = await fetch(base + '/api/health')
    assert.equal(health.status, 200)
    assert.equal((await health.json()).database, 'connected')
    const registration = { username: 'CloudTester', email: 'cloud@example.test', password: 'safe-test-password-only' }
    const denied = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { Origin: 'https://unrelated.vercel.app', 'Content-Type': 'application/json' }, body: JSON.stringify(registration),
    })
    assert.equal(denied.status, 403)
    const register = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(registration),
    })
    assert.equal(register.status, 201, await register.text())
    assert.equal(register.headers.get('access-control-allow-origin'), origin)
    assert.match(register.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/)
    const cookie = register.headers.get('set-cookie').split(';')[0]
    const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT8AAAAASUVORK5CYII=', 'base64')
    const uploaded = await fetch(base + '/api/users/me/avatar', {
      method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'image/png' }, body: photo,
    })
    assert.equal(uploaded.status, 200)
    const photoUrl = (await uploaded.json()).user.avatar
    assert.equal(await mongoose.connection.collection('avatars').countDocuments(), 1)
    const tooLarge = await fetch(base + '/api/users/me/avatar', {
      method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'image/png' }, body: Buffer.alloc(3 * 1024 * 1024 + 1),
    })
    assert.equal(tooLarge.status, 413)
    await mongoose.disconnect()
    const served = await fetch(base + photoUrl)
    assert.equal(served.status, 200)
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), photo)
    const account = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })
    assert.equal((await account.json()).user.avatar, photoUrl)
    assert.match(account.headers.get('cache-control'), /no-store/)
    const missing = await fetch(base + '/api/not-a-real-route')
    assert.equal(missing.status, 404)
    assert.match(missing.headers.get('content-type'), /application\/json/)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, database)
      await mongoose.connection.dropDatabase()
    }
    await mongoose.disconnect()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
