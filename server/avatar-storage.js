import mongoose from 'mongoose'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const storage = () => process.env.AVATAR_STORAGE || (process.env.VERCEL === '1' ? 'mongodb' : 'filesystem')
const localPath = (filename) => path.join(path.resolve(process.env.AVATAR_UPLOAD_DIR || 'uploads/avatars'), filename)
const checkFilename = (filename) => {
  if (!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(filename)) throw new Error('Invalid avatar filename.')
}

export async function writeAvatar(filename, bytes) {
  checkFilename(filename)
  if (storage() === 'mongodb') {
    // Photos are capped at 3 MB, safely below MongoDB's document-size limit.
    await mongoose.connection.collection('avatars').insertOne({ _id: filename, bytes, createdAt: new Date() })
    return
  }
  if (storage() !== 'filesystem') throw new Error('AVATAR_STORAGE must be mongodb or filesystem.')
  await mkdir(path.dirname(localPath(filename)), { recursive: true })
  await writeFile(localPath(filename), bytes, { flag: 'wx' })
}

export async function readAvatar(filename) {
  checkFilename(filename)
  if (storage() === 'mongodb') {
    const avatar = await mongoose.connection.collection('avatars').findOne({ _id: filename })
    return avatar ? Buffer.from(avatar.bytes.buffer) : null
  }
  if (storage() !== 'filesystem') throw new Error('AVATAR_STORAGE must be mongodb or filesystem.')
  try { return await readFile(localPath(filename)) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
