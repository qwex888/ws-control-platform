import { createServer as createHttpServer } from 'node:http'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authRouter } from './auth/routes'
import { requireAuth } from './middleware/auth'
import { requireCsrf } from './middleware/csrf'
import { createDeviceRouter } from './device/routes'
import { DeviceConfigRepo } from './device/repo'
import { attachWebSocket } from './ws/handler'
import {
  createCorsOriginChecker,
  loadHttpSecurityConfig,
  logHttpSecurityConfig,
} from './config/httpSecurity'

export const createServer = () => {
  const app = express()
  const httpSecurity = loadHttpSecurityConfig()
  logHttpSecurityConfig(httpSecurity)

  app.use(cors({
    origin: createCorsOriginChecker(httpSecurity),
    credentials: true,
  }))

  app.use(helmet())
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })

  const deviceConfigRepo = new DeviceConfigRepo()

  app.use('/auth', authLimiter, authRouter)
  app.use('/api', apiLimiter, requireAuth)
  app.use('/api/device', requireCsrf, createDeviceRouter(deviceConfigRepo))

  app.get('/api/me', (req, res) => {
    const user = (req as express.Request & { user?: { username: string } }).user
    res.json({ success: true, data: user ?? null, error: null })
  })

  const httpServer = createHttpServer(app)
  const wsCtx = attachWebSocket(httpServer, deviceConfigRepo)

  return { app, httpServer, wsCtx, deviceConfigRepo }
}

if (process.env.NODE_ENV !== 'test') {
  const { httpServer, deviceConfigRepo } = createServer()
  deviceConfigRepo.load().then(() => {
    const port = Number(process.env.PORT ?? 13701)
    httpServer.listen(port, () => {
      console.log(`[server] gateway listening on http://0.0.0.0:${port}`)
      console.log(`[server] NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}`)
    })
  }).catch((err) => {
    console.error('[server] failed to load device configs:', err)
    process.exit(1)
  })
}
