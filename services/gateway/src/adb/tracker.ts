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

  async start() {
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
      this.emit('end')
    })
  }

  stop() {
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
