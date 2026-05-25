import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../server'

describe('auth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret'
    process.env.NODE_ENV = 'production'
  })

  it('sets HttpOnly cookie on login', async () => {
    const { app } = createServer()
    const response = await request(app)
      .post('/auth/login')
      .send({ secret: 'test-secret' })

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
      .send({ secret: 'test-secret' })

    const cookie = login.headers['set-cookie']
    const response = await request(app).get('/api/me').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({ username: 'admin' })
  })

  it('returns status with initialized true when JWT_SECRET set', async () => {
    const { app } = createServer()
    const response = await request(app).get('/auth/status')

    expect(response.status).toBe(200)
    expect(response.body.data.initialized).toBe(true)
    expect(response.body.data.authenticated).toBe(false)
  })

  it('rejects invalid secret on login', async () => {
    const { app } = createServer()
    const response = await request(app)
      .post('/auth/login')
      .send({ secret: 'wrong-secret' })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('INVALID_SECRET')
  })
})
