import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Illustrations for fictional demo profiles; these are not photographs of real people.
export async function writeDemoAvatars(users, directory) {
  await mkdir(directory, { recursive: true })
  const backgrounds = ['#b6ff00', '#fac18d', '#a9c6ff', '#e4adff', '#ff9da1', '#93dfd1']
  const skin = ['#c58457', '#d99f76', '#aa704d', '#edbd91', '#8b5b40']
  for (const [index, user] of users.entries()) {
    if (!/^demo_[a-z0-9_]{1,25}$/.test(user.username)) throw new Error('Invalid demo avatar filename.')
    const background = backgrounds[index % backgrounds.length]
    const face = skin[index % skin.length]
    const hair = index % 3 === 0 ? '#3f2c21' : '#211b18'
    const shirt = ['#343f26', '#384778', '#8d4042', '#475754'][index % 4]
    const hairstyle = index % 2 === 0 ? `<path d="M27 47 Q25 13 49 13 Q78 12 76 49 L69 45 L65 27 Q49 40 34 27 L33 46Z" fill="${hair}"/>` : `<path d="M24 73 V40 Q24 13 50 14 Q79 13 78 44 V75 L65 66 V31 L36 30 V69Z" fill="${hair}"/>`
    const glasses = index % 4 === 0 ? '<g fill="none" stroke="#29241f" stroke-width="2"><rect x="35" y="41" width="13" height="10" rx="3"/><rect x="53" y="41" width="13" height="10" rx="3"/><path d="M48 44h5"/></g>' : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Illustrated demo profile"><rect width="100" height="100" rx="50" fill="${background}"/><path d="M13 100 Q15 71 50 71 Q86 71 89 100" fill="${shirt}"/><path d="M41 62 V76 Q50 87 59 76 V62" fill="${face}"/>${hairstyle}<ellipse cx="50" cy="46" rx="21" ry="27" fill="${face}"/><path d="M29 37 Q26 13 49 13 Q76 12 73 36 Q63 24 56 24 Q43 34 29 37" fill="${hair}"/><g fill="#30241d"><ellipse cx="42" cy="45" rx="2" ry="2.5"/><ellipse cx="59" cy="45" rx="2" ry="2.5"/></g><path d="M46 58 Q51 62 56 58" stroke="#6b3a2a" stroke-width="2" fill="none" stroke-linecap="round"/>${glasses}<path d="M33 85l-8 15M68 85l8 15" stroke="#ffffff30" stroke-width="2"/></svg>`
    await writeFile(path.join(directory, user.username + '.svg'), svg, 'utf8')
  }
}
