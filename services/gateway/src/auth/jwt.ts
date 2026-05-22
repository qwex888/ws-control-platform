import jwt from 'jsonwebtoken'

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is required')
  }
  return secret
}

export type AuthPayload = {
  sub: string
}

export const signAccessToken = (payload: AuthPayload): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' })

export const verifyAccessToken = (token: string): AuthPayload =>
  jwt.verify(token, getJwtSecret()) as AuthPayload
