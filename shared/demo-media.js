export function demoMediaPath(source) {
  if (typeof source !== 'string') return null
  const match = source.match(/^https:\/\/images\.unsplash\.com\/(photo-[a-z0-9-]+)(?:\?|$)/)
  return match ? '/demo/images/' + match[1] + '.jpg' : null
}
