import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDemoData } from './demo-data.js'
import { demoMediaPath } from '../shared/demo-media.js'

export async function cacheDemoImages(directory = path.resolve('public/demo/images')) {
  const data = buildDemoData()
  const urls = [...new Set([...data.scenes.map((scene) => scene.image), ...data.posts.map((post) => post.mediaUrl)])]
  await mkdir(directory, { recursive: true })
  for (let index = 0; index < urls.length; index += 4) {
    await Promise.all(urls.slice(index, index + 4).map(async (url) => {
      const asset = demoMediaPath(url)
      if (!asset) throw new Error('Demo image must use the expected public image source.')
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/jpeg') throw new Error('Demo image download failed: ' + response.status)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 100 || bytes.length > 5 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Demo image did not return a valid JPEG.')
      await writeFile(path.join(directory, path.basename(asset)), bytes)
    }))
  }
  return urls.length
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Cached ${await cacheDemoImages()} validated demo photos in public/demo/images.`) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
