import { createServer as createHttpServer } from 'node:http'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { authRouter } from './auth/routes'
import { requireAuth } from './middleware/auth'
import { createDeviceRouter } from './device/routes'
import { DeviceConfigRepo } from './device/repo'
import { attachWebSocket } from './ws/handler'

export const createServer = () => {
  const app = express()

  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())

  const deviceConfigRepo = new DeviceConfigRepo()

  app.use('/auth', authRouter)

  if (process.env.NODE_ENV === 'production') {
    app.use('/api', requireAuth)
  }

  app.get('/api/me', (req, res) => {
    const user = (req as express.Request & { user?: { username: string } }).user
    res.json({ success: true, data: user ?? { username: 'dev' }, error: null })
  })

  const httpServer = createHttpServer(app)
  const wsCtx = attachWebSocket(httpServer, deviceConfigRepo)

  app.use('/api/device', createDeviceRouter(deviceConfigRepo, {
    onDeviceListChanged: () => wsCtx.refreshDeviceList(),
  }))

  return { app, httpServer, wsCtx, deviceConfigRepo }
}

if (process.env.NODE_ENV !== 'test') {
  const { httpServer, deviceConfigRepo } = createServer()
  deviceConfigRepo.load().then(() => {
    const port = Number(process.env.PORT ?? 13701)
    httpServer.listen(port, () => {
      console.log(`[server] gateway listening on http://0.0.0.0:${port}`)
      console.log(`[server] NODE_ENV=${process.env.NODE_ENV ?? 'undefined'}`)
      console.log(`[server] auth=${process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled (dev)'}`)
    })
  }).catch((err) => {
    console.error('[server] failed to load device configs:', err)
    process.exit(1)
  })
}
