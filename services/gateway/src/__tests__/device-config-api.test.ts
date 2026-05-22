import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createServer } from '../server'

const loginAndGetAuth = async () => {
  const { app } = createServer()
  const login = await request(app)
    .post('/auth/login')
    .send({ username: 'admin', password: 'admin123' })

  const cookieHeader = login.headers['set-cookie']
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [String(cookieHeader)] : []
  const csrfCookie = cookies.find((item) => item.startsWith('csrf_token=')) ?? ''
  const csrfToken = csrfCookie.split(';')[0].split('=')[1]

  return { app, cookie: cookies, csrfToken }
}

describe('device config api', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.AUTH_USERNAME = 'admin'
    process.env.AUTH_PASSWORD = 'admin123'
    process.env.COOKIE_SECURE = 'false'
  })

  it('creates config on first connect', async () => {
    const { app, cookie, csrfToken } = await loginAndGetAuth()
    const connect = await request(app)
      .post('/api/device/connect')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken)
      .send({
        serial: 'SER001',
        transportId: '2',
        config: { fps: 60, bitrate: 8000000 },
      })

    expect(connect.status).toBe(200)
    expect(connect.body.data.created).toBe(true)

    const getConfig = await request(app)
      .get('/api/device/config?serial=SER001&transportId=2')
      .set('Cookie', cookie)

    expect(getConfig.status).toBe(200)
    expect(getConfig.body.data.config.fps).toBe(60)
  })

  it('uses updated config on next connect', async () => {
    const { app, cookie, csrfToken } = await loginAndGetAuth()

    await request(app)
      .post('/api/device/connect')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken)
      .send({
        serial: 'SER002',
        transportId: '3',
        config: { fps: 30, maxSize: 1080 },
      })

    const update = await request(app)
      .put('/api/device/config')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken)
      .send({
        serial: 'SER002',
        transportId: '3',
        config: { fps: 120, maxSize: 1440 },
      })

    expect(update.status).toBe(200)

    const reconnect = await request(app)
      .post('/api/device/connect')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken)
      .send({ serial: 'SER002', transportId: '3' })

    expect(reconnect.status).toBe(200)
    expect(reconnect.body.data.created).toBe(false)
    expect(reconnect.body.data.usedConfig).toEqual({ fps: 120, maxSize: 1440 })
  })
})
