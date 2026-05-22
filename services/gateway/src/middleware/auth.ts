import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../auth/jwt'

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.access_token
  if (!token) {
    res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
    return
  }

  try {
    const payload = verifyAccessToken(token)
    ;(req as Request & { user?: { username: string } }).user = { username: payload.sub }
    next()
  } catch {
    res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
  }
}
