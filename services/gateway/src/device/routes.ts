import { Router } from 'express'
import { DeviceConfigRepo } from './repo'
import { deviceConnectPayloadSchema, type DeviceConfigKey } from './schema'
import { checkAdbStatus, checkRootStatus, connectWireless, disconnectWireless } from '../adb/wireless'

type DeviceRouterOptions = {
  onDeviceListChanged?: () => void
}

export const createDeviceRouter = (repo: DeviceConfigRepo, options?: DeviceRouterOptions) => {
  const router = Router()

  router.get('/config', (req, res) => {
    const serial = String(req.query.serial ?? '')
    if (!serial) {
      res.status(400).json({ success: false, data: null, error: 'INVALID_DEVICE_KEY' })
      return
    }

    const user = (req as { user?: { username: string } }).user
    if (!user?.username) {
      res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
      return
    }

    const userId = user.username
    const transportId = String(req.query.transportId ?? serial)
    const record = repo.get(userId, { serial, transportId })
        ?? repo.getBySerial(userId, serial)
    res.json({ success: true, data: record, error: null })
  })

  router.put('/config', (req, res) => {
    const parsed = deviceConnectPayloadSchema.safeParse(req.body)
    if (!parsed.success || !parsed.data.config) {
      res.status(400).json({ success: false, data: null, error: 'INVALID_PAYLOAD' })
      return
    }

    const user = (req as { user?: { username: string } }).user
    if (!user?.username) {
      res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
      return
    }

    const key: DeviceConfigKey = { serial: parsed.data.serial, transportId: parsed.data.transportId ?? parsed.data.serial }
    const userId = user.username
    const record = repo.upsert(userId, key, parsed.data.config)
    res.json({ success: true, data: record, error: null })
  })

  router.post('/connect', (req, res) => {
    const parsed = deviceConnectPayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, data: null, error: 'INVALID_PAYLOAD' })
      return
    }

    const user = (req as { user?: { username: string } }).user
    if (!user?.username) {
      res.status(401).json({ success: false, data: null, error: 'UNAUTHORIZED' })
      return
    }

    const key: DeviceConfigKey = { serial: parsed.data.serial, transportId: parsed.data.transportId ?? parsed.data.serial }
    const userId = user.username
    const existing = repo.get(userId, key)

    if (!existing) {
      if (!parsed.data.config) {
        res.status(400).json({ success: false, data: null, error: 'CONFIG_REQUIRED_ON_FIRST_CONNECT' })
        return
      }
      const created = repo.upsert(userId, key, parsed.data.config)
      res.json({ success: true, data: { usedConfig: created.config, created: true }, error: null })
      return
    }

    res.json({ success: true, data: { usedConfig: existing.config, created: false }, error: null })
  })

  router.get('/root-status', async (req, res) => {
    const serial = String(req.query.serial ?? '').trim()
    if (!serial) {
      res.status(400).json({ success: false, data: null, error: 'MISSING_SERIAL' })
      return
    }
    try {
      const status = await checkRootStatus(serial)
      res.json({ success: true, data: status, error: null })
    } catch (err) {
      res.status(500).json({ success: false, data: null, error: String(err) })
    }
  })

  router.get('/adb-status', async (_req, res) => {
    try {
      const status = await checkAdbStatus()
      res.json({ success: true, data: status, error: null })
    } catch (err) {
      res.status(500).json({ success: false, data: null, error: String(err) })
    }
  })

  router.post('/adb-connect', async (req, res) => {
    const host = String(req.body?.host ?? '').trim()
    const port = Number(req.body?.port ?? 5555)

    if (!host) {
      res.status(400).json({ success: false, data: null, error: 'MISSING_HOST' })
      return
    }
    if (port < 1 || port > 65535) {
      res.status(400).json({ success: false, data: null, error: 'INVALID_PORT' })
      return
    }

    try {
      const result = await connectWireless(host, port)
      res.json({ success: result.success, data: { message: result.message }, error: result.success ? null : result.message })
      if (result.success && options?.onDeviceListChanged) {
        setTimeout(() => options.onDeviceListChanged!(), 800)
      }
    } catch (err) {
      res.status(500).json({ success: false, data: null, error: String(err) })
    }
  })

  router.post('/adb-disconnect', async (req, res) => {
    const address = String(req.body?.address ?? '').trim()
    if (!address) {
      res.status(400).json({ success: false, data: null, error: 'MISSING_ADDRESS' })
      return
    }

    try {
      const result = await disconnectWireless(address)
      res.json({ success: result.success, data: { message: result.message }, error: result.success ? null : result.message })
      if (result.success && options?.onDeviceListChanged) {
        setTimeout(() => options.onDeviceListChanged!(), 500)
      }
    } catch (err) {
      res.status(500).json({ success: false, data: null, error: String(err) })
    }
  })

  return router
}
