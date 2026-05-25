import { Router } from 'express'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { signAccessToken } from './jwt'
import { getCookieOptions, loadHttpSecurityConfig } from '../config/httpSecurity'

const getAuthConfig = () => {
  const username = process.env.AUTH_USERNAME
  const password = process.env.AUTH_PASSWORD
  if (!username || !password) {
    throw new Error('AUTH_USERNAME and AUTH_PASSWORD are required')
  }
  return { username, password }
}

const safeEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export const authRouter = Router()

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) {
    res.status(400).json({ success: false, data: null, error: 'INVALID_PAYLOAD' })
    return
  }

  const auth = getAuthConfig()
  const valid = safeEqual(username, auth.username) && safeEqual(password, auth.password)
  if (!valid) {
    res.status(401).json({ success: false, data: null, error: 'INVALID_CREDENTIALS' })
    return
  }

  const token = signAccessToken({ sub: username })
  const csrfToken = randomBytes(24).toString('hex')
  const cookieOptions = getCookieOptions(loadHttpSecurityConfig())

  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    path: '/',
  })
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    path: '/',
  })

  res.json({ success: true, data: { username, csrfToken }, error: null })
})

authRouter.post('/logout', (_req, res) => {
  const cookieOptions = getCookieOptions(loadHttpSecurityConfig())
  const clearOptions = {
    path: '/',
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  }

  res.clearCookie('access_token', clearOptions)
  res.clearCookie('csrf_token', clearOptions)
  res.json({ success: true, data: null, error: null })
})
