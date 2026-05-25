import { Router } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { signAccessToken, verifyAccessToken } from './jwt'
import { hasSecret, getSecret, saveSecret } from './secretStore'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  path: '/',
}

const safeEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function issueSession(res: import('express').Response) {
  const token = signAccessToken({ sub: 'admin' })
  res.cookie('access_token', token, COOKIE_OPTIONS)
}

export const authRouter = Router()

authRouter.get('/status', (req, res) => {
  const initialized = hasSecret()
  let authenticated = false

  const token = req.cookies?.access_token
  if (token) {
    try {
      verifyAccessToken(token)
      authenticated = true
    } catch {
      authenticated = false
    }
  }

  res.json({ success: true, data: { initialized, authenticated }, error: null })
})

authRouter.post('/setup', (req, res) => {
  if (hasSecret()) {
    res.status(403).json({ success: false, data: null, error: 'ALREADY_INITIALIZED' })
    return
  }

  const { secret } = req.body as { secret?: string }
  if (!secret || secret.length < 4) {
    res.status(400).json({ success: false, data: null, error: 'SECRET_TOO_SHORT' })
    return
  }

  saveSecret(secret)
  issueSession(res)
  res.json({ success: true, data: { message: 'initialized' }, error: null })
})

authRouter.post('/login', (req, res) => {
  const { secret } = req.body as { secret?: string }
  if (!secret) {
    res.status(400).json({ success: false, data: null, error: 'INVALID_PAYLOAD' })
    return
  }

  const stored = getSecret()
  if (!stored) {
    res.status(400).json({ success: false, data: null, error: 'NOT_INITIALIZED' })
    return
  }

  if (!safeEqual(secret, stored)) {
    res.status(401).json({ success: false, data: null, error: 'INVALID_SECRET' })
    return
  }

  issueSession(res)
  res.json({ success: true, data: { message: 'authenticated' }, error: null })
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('access_token', { path: '/' })
  res.json({ success: true, data: null, error: null })
})
