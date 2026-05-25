import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken, signAccessToken } from '../auth/jwt'

const isDev = () => process.env.NODE_ENV !== 'production'

const FIFTEEN_DAYS_S = 15 * 24 * 60 * 60

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (isDev()) {
    ;(req as Request & { user?: { username: string } }).user = { username: 'dev' }
    next()
    return
  }

  const token = req.cookies?.access_token
  if (!token) {
    res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
    return
  }

  try {
    const payload = verifyAccessToken(token)
    ;(req as Request & { user?: { username: string } }).user = { username: payload.sub }

    if (payload.exp) {
      const remaining = payload.exp - Math.floor(Date.now() / 1000)
      if (remaining < FIFTEEN_DAYS_S) {
        const refreshed = signAccessToken({ sub: payload.sub })
        res.cookie('access_token', refreshed, {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          path: '/',
        })
      }
    }

    next()
  } catch {
    res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
  }
}
