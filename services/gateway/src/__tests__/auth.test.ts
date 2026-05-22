import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../server'

describe('auth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.AUTH_USERNAME = 'admin'
    process.env.AUTH_PASSWORD = 'admin123'
    process.env.COOKIE_SECURE = 'false'
  })

  it('sets HttpOnly cookie on login', async () => {
    const { app } = createServer()
    const response = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })

    expect(response.status).toBe(200)
    const cookies = response.headers['set-cookie']
    const setCookie = Array.isArray(cookies) ? cookies.join(';') : String(cookies ?? '')
    expect(setCookie).toContain('access_token=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('rejects unauthenticated protected api', async () => {
    const { app } = createServer()
    const response = await request(app).get('/api/me')
    expect(response.status).toBe(401)
  })

  it('accepts authenticated protected api', async () => {
    const { app } = createServer()
    const login = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })

    const cookie = login.headers['set-cookie']
    const response = await request(app).get('/api/me').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({ username: 'admin' })
  })
})
