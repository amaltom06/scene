import express from 'express'
import app from '../server/app.js'
import { connectDatabase } from '../server/database.js'

// Export an Express app so Vercel preserves the raw binary request stream.
const handler = express()
handler.disable('x-powered-by')
handler.use(async (_request, response, next) => {
  try { await connectDatabase() }
  catch (error) {
    console.error('Database connection failed:', error.name)
    response.setHeader('Cache-Control', 'private, no-store')
    response.statusCode = 503
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'Database unavailable. Please try again shortly.', status: 'unavailable', database: 'unavailable' }))
    return
  }
  next()
})
handler.use(app)

export default handler
