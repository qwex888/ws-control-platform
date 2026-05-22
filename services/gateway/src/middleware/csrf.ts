import type { NextFunction, Request, Response } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const requireCsrf = (req: Request, res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next()
    return
  }

  const cookieToken = req.cookies?.csrf_token
  const headerToken = req.get('x-csrf-token')
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ success: false, data: null, error: 'CSRF_INVALID' })
    return
  }

  next()
}
