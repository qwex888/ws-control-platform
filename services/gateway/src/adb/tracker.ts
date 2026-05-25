import { EventEmitter } from 'node:events'
import { getAdbClient, type AdbDevice } from './client'

export interface DeviceEvent {
  serial: string
  type: 'add' | 'remove' | 'change'
  device: AdbDevice
}

export class DeviceTracker extends EventEmitter {
  private trackerHandle: Awaited<ReturnType<ReturnType<typeof getAdbClient>['trackDevices']>> | null = null
  private devices = new Map<string, AdbDevice>()
  private stopped = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async start() {
    this.stopped = false
    await this.connect()
  }

  private async connect() {
    try {
      const client = getAdbClient()
      const tracker = await client.trackDevices()
      this.trackerHandle = tracker

      tracker.on('add', (device) => {
        const d: AdbDevice = { id: device.id, type: device.type }
        this.devices.set(d.id, d)
        this.emit('device', { serial: d.id, type: 'add', device: d } satisfies DeviceEvent)
      })

      tracker.on('remove', (device) => {
        const d: AdbDevice = { id: device.id, type: device.type }
        this.devices.delete(d.id)
        this.emit('device', { serial: d.id, type: 'remove', device: d } satisfies DeviceEvent)
      })

      tracker.on('change', (device) => {
        const d: AdbDevice = { id: device.id, type: device.type }
        this.devices.set(d.id, d)
        this.emit('device', { serial: d.id, type: 'change', device: d } satisfies DeviceEvent)
      })

      tracker.on('end', () => {
        this.trackerHandle = null
        this.scheduleReconnect()
      })

      ;(tracker as unknown as import('node:events').EventEmitter).on('error', () => {
        this.trackerHandle = null
        this.scheduleReconnect()
      })

      console.log('[tracker] connected to ADB server, tracking devices')
    } catch (err) {
      console.warn('[tracker] failed to connect:', err)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return
    if (this.reconnectTimer) return
    console.log('[tracker] will reconnect in 3s...')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.stopped) this.connect()
    }, 3000)
  }

  stop() {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.trackerHandle) {
      this.trackerHandle.end()
      this.trackerHandle = null
    }
    this.devices.clear()
  }

  getDevices(): AdbDevice[] {
    return Array.from(this.devices.values())
  }
}
