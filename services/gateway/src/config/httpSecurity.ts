import type { CookieOptions } from 'express'

export type CookieSameSite = 'lax' | 'strict' | 'none'

export type HttpSecurityConfig = {
  cors: {
    allowAll: boolean
    allowedOrigins: string[]
  }
  cookie: {
    secure: boolean
    sameSite: CookieSameSite
  }
}

const DEFAULT_DEV_ORIGINS = ['http://localhost:5173']

function parseBooleanTriState(
  value: string | undefined,
  autoValue: boolean,
): boolean {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  if (normalized === 'auto' || !normalized) return autoValue
  return autoValue
}

function parseSameSite(value: string | undefined): CookieSameSite | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized
  }
  return null
}

function parseAllowedOrigins(env: NodeJS.ProcessEnv): { allowAll: boolean; allowedOrigins: string[] } {
  if (env.CORS_ALLOW_ALL === 'true') {
    return { allowAll: true, allowedOrigins: [] }
  }

  const raw = env.ALLOWED_ORIGINS
  if (raw === undefined) {
    return { allowAll: false, allowedOrigins: [] }
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return { allowAll: false, allowedOrigins: [] }
  }

  if (trimmed === '*' || trimmed.toLowerCase() === 'all') {
    return { allowAll: true, allowedOrigins: [] }
  }

  const allowedOrigins = trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return { allowAll: false, allowedOrigins }
}

function resolveCookieSameSite(
  explicit: CookieSameSite | null,
  secure: boolean,
  cors: HttpSecurityConfig['cors'],
  env: NodeJS.ProcessEnv,
): CookieSameSite {
  if (explicit) {
    return explicit
  }

  const crossOriginCookies = env.CROSS_ORIGIN_COOKIES === 'true'
  const publicUrl = env.PUBLIC_URL?.trim()
  const likelyCrossOrigin =
    crossOriginCookies ||
    (cors.allowAll && !publicUrl) ||
    (cors.allowedOrigins.length > 1 && !publicUrl)

  if (secure && likelyCrossOrigin) {
    return 'none'
  }

  return 'lax'
}

function resolveCookieSecure(env: NodeJS.ProcessEnv, isProduction: boolean): boolean {
  const explicit = env.COOKIE_SECURE?.trim().toLowerCase()
  if (explicit === 'true') return true
  if (explicit === 'false') return false

  const publicUrl = env.PUBLIC_URL?.trim()
  if (publicUrl) {
    return publicUrl.startsWith('https://')
  }

  return isProduction
}

export function loadHttpSecurityConfig(env: NodeJS.ProcessEnv = process.env): HttpSecurityConfig {
  const isProduction = env.NODE_ENV === 'production'
  const cors = parseAllowedOrigins(env)

  if (!cors.allowAll && cors.allowedOrigins.length === 0) {
    cors.allowedOrigins.push(...DEFAULT_DEV_ORIGINS)
  }

  const secure = resolveCookieSecure(env, isProduction)
  const publicUrl = env.PUBLIC_URL?.trim()
  if (publicUrl?.startsWith('http://') && secure) {
    console.warn(
      '[server] PUBLIC_URL 为 HTTP 但 Cookie Secure=true，浏览器不会在 HTTP 下保存登录 Cookie（请设 COOKIE_SECURE=false）',
    )
  }

  const explicitSameSite = parseSameSite(env.COOKIE_SAME_SITE)
  const sameSite = resolveCookieSameSite(explicitSameSite, secure, cors, env)

  const effectiveSecure = sameSite === 'none' ? true : secure

  return {
    cors,
    cookie: {
      secure: effectiveSecure,
      sameSite,
    },
  }
}

export function createCorsOriginChecker(config: HttpSecurityConfig) {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (config.cors.allowAll || !origin || config.cors.allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'))
  }
}

export function getCookieOptions(config: HttpSecurityConfig): Pick<CookieOptions, 'secure' | 'sameSite'> {
  return {
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  }
}

export function logHttpSecurityConfig(config: HttpSecurityConfig) {
  const corsMode = config.cors.allowAll
    ? 'allow-all'
    : `whitelist(${config.cors.allowedOrigins.join(', ')})`

  console.log(
    `[server] http security: cors=${corsMode}, cookie.secure=${config.cookie.secure}, cookie.sameSite=${config.cookie.sameSite}`,
  )
}
