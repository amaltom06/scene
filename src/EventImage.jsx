import { demoMediaPath } from '../shared/demo-media.js'

export default function EventImage({ src, isDemo, ...props }) {
  const cached = isDemo ? demoMediaPath(src) : null
  return <img key={src} {...props} src={cached || src} onError={(event) => {
    if (cached && !event.currentTarget.dataset.remoteFallback) {
      event.currentTarget.dataset.remoteFallback = 'true'
      event.currentTarget.src = src
    }
  }} />
}
