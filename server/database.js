import 'dotenv/config'
import mongoose from 'mongoose'

let connecting

// Reuse one small connection pool for each warm Vercel Function instance.
export async function connectDatabase() {
  if (connecting) return connecting
  if (mongoose.connection.readyState === 1) return mongoose
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scene'
  connecting = mongoose.connect(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
    serverSelectionTimeoutMS: 10000,
  }).then(async (connection) => {
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()))
    return connection
  }).finally(() => { connecting = undefined })
  return connecting
}
