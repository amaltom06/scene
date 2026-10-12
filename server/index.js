import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app.js'
import { connectDatabase } from './database.js'

const port = Number(process.env.PORT || 4000)
const server = app.listen(port, () => console.log(`Scene API listening on http://localhost:${port}`))
connectDatabase().then(() => console.log('Connected to MongoDB')).catch(() => console.warn('MongoDB unavailable. Check MONGODB_URI and database network access.'))
const shutdown = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)))
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
