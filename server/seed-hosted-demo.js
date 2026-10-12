import { config } from 'dotenv'
import { randomBytes } from 'node:crypto'
import { seedDemoData, assertHostedDemoTarget } from './seed-demo.js'

config({ path: '.env.hosted.local', quiet: true })
try {
  assertHostedDemoTarget(process.env.DEMO_MONGODB_URI)
  const result = await seedDemoData({
    mongoUri: process.env.DEMO_MONGODB_URI,
    target: 'hosted-demo',
    password: randomBytes(32).toString('hex'),
  })
  console.log('Hosted fictional community ready. Existing records were preserved.')
  console.log(JSON.stringify(result, null, 2))
  console.log('Create your own account on the website. Local demo sign-in stays disabled in production.')
} catch (error) {
  // Connection errors can contain credentials or host information; do not echo them.
  console.error('Hosted demo seed failed (' + error.name + '). Check the Atlas URI, scene_demo database, database user, and network access.')
  process.exitCode = 1
}
