import jwt from 'jsonwebtoken'
import { getSecret } from './secretStore'

const getJwtSecret = (): string => {
  const secret = getSecret()
  if (!secret) {
    throw new Error('JWT secret not configured')
  }
  return secret
}

export type AuthPayload = {
  sub: string
  iat?: number
  exp?: number
}

export const signAccessToken = (payload: { sub: string }): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' })

export const verifyAccessToken = (token: string): AuthPayload =>
  jwt.verify(token, getJwtSecret()) as AuthPayload
