export function deploymentConfig(env = process.env) {
  const secureCookie = env.NODE_ENV === 'production' || env.VERCEL === '1'
  const authSecret = env.AUTH_SECRET || 'development-only-change-me'
  if (secureCookie && (authSecret.length < 32 || /^(development-only|replace-with)/.test(authSecret))) {
    throw new Error('Set AUTH_SECRET to a random secret of at least 32 characters.')
  }
  if (secureCookie && !env.MONGODB_URI) throw new Error('MONGODB_URI must be configured in production.')
  const vercelOrigins = ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']
    .filter((key) => env[key]).map((key) => `https://${env[key]}`)
  const publicAppUrl = env.PUBLIC_APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  const configured = [...(env.CORS_ORIGIN || '').split(','), publicAppUrl, ...vercelOrigins].filter((origin) => origin.trim())
  const allowedOrigins = [...new Set(configured.map((value) => {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('App origins must be an HTTP(S) origin without a path or credentials.')
    }
    return url.origin
  }))]
  if (!secureCookie && !allowedOrigins.length) allowedOrigins.push('http://localhost:5173')
  return { secureCookie, authSecret, publicAppUrl, allowedOrigins }
}
