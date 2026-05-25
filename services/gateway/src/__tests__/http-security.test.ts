import { describe, expect, it } from 'vitest'
import {
  createCorsOriginChecker,
  getCookieOptions,
  loadHttpSecurityConfig,
} from '../config/httpSecurity'

describe('loadHttpSecurityConfig', () => {
  it('allows all origins when ALLOWED_ORIGINS is *', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: '*',
      COOKIE_SECURE: 'false',
    })

    expect(config.cors.allowAll).toBe(true)
    expect(config.cors.allowedOrigins).toEqual([])
  })

  it('allows all origins when CORS_ALLOW_ALL=true', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      CORS_ALLOW_ALL: 'true',
      COOKIE_SECURE: 'false',
    })

    expect(config.cors.allowAll).toBe(true)
  })

  it('parses comma-separated origin whitelist', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: 'http://a.test, http://b.test',
      COOKIE_SECURE: 'false',
    })

    expect(config.cors.allowAll).toBe(false)
    expect(config.cors.allowedOrigins).toEqual(['http://a.test', 'http://b.test'])
  })

  it('uses auto secure cookie in production', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://app.example.com',
      COOKIE_SECURE: 'auto',
    })

    expect(config.cookie.secure).toBe(true)
    expect(config.cookie.sameSite).toBe('lax')
  })

  it('disables secure cookie when PUBLIC_URL is http', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'production',
      PUBLIC_URL: 'http://192.168.31.249:28081',
      ALLOWED_ORIGINS: 'http://192.168.31.249:28081',
      COOKIE_SECURE: 'auto',
    })

    expect(config.cookie.secure).toBe(false)
    expect(config.cookie.sameSite).toBe('lax')
  })

  it('uses none sameSite for cross-origin cookies when secure', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://a.example.com,https://b.example.com',
      COOKIE_SECURE: 'true',
      COOKIE_SAME_SITE: 'auto',
    })

    expect(config.cookie.sameSite).toBe('none')
    expect(config.cookie.secure).toBe(true)
  })

  it('forces secure when sameSite is none', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: '*',
      COOKIE_SECURE: 'false',
      COOKIE_SAME_SITE: 'none',
    })

    expect(config.cookie.sameSite).toBe('none')
    expect(config.cookie.secure).toBe(true)
  })
})

describe('createCorsOriginChecker', () => {
  it('defaults to localhost dev origin when ALLOWED_ORIGINS is unset', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      COOKIE_SECURE: 'false',
    })

    expect(config.cors.allowAll).toBe(false)
    expect(config.cors.allowedOrigins).toEqual(['http://localhost:5173'])
  })

  it('accepts any origin when allowAll is enabled', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: '*',
      COOKIE_SECURE: 'false',
    })
    const check = createCorsOriginChecker(config)

    let allowed = false
    check('https://any.example.com', (err, allow) => {
      expect(err).toBeNull()
      allowed = allow === true
    })
    expect(allowed).toBe(true)
  })

  it('rejects origins outside whitelist', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: 'http://localhost:28081',
      COOKIE_SECURE: 'false',
    })
    const check = createCorsOriginChecker(config)

    let error: Error | null = null
    check('http://evil.test', (err) => {
      error = err
    })
    expect(error).toBeInstanceOf(Error)
  })
})

describe('getCookieOptions', () => {
  it('returns shared cookie options for auth routes', () => {
    const config = loadHttpSecurityConfig({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://app.example.com',
      COOKIE_SECURE: 'true',
      COOKIE_SAME_SITE: 'strict',
    })

    expect(getCookieOptions(config)).toEqual({
      secure: true,
      sameSite: 'strict',
    })
  })
})
