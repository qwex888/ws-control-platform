import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { makeDeviceKey, type DeviceConfigKey, type DeviceConfigRecord, type DeviceConnectConfig } from './schema'

type StoreData = Record<string, DeviceConfigRecord>

const DEFAULT_DIR = path.resolve(process.cwd(), 'data')
const DEFAULT_FILE = 'device-configs.json'

export class DeviceConfigRepo {
  private store = new Map<string, DeviceConfigRecord>()
  private readonly filePath: string
  private dirty = false
  private writeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(dataDir?: string) {
    const dir = dataDir ?? DEFAULT_DIR
    this.filePath = path.join(dir, DEFAULT_FILE)
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const data: StoreData = JSON.parse(raw)
      this.store.clear()
      for (const [key, record] of Object.entries(data)) {
        this.store.set(key, record)
      }
    } catch (err: any) {
      if (err?.code === 'ENOENT') return
      console.error('[device-config] failed to load config file:', err)
    }
  }

  private scheduleSave(): void {
    this.dirty = true
    if (this.writeTimer) return
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.flush().catch((err) => {
        console.error('[device-config] failed to save config file:', err)
      })
    }, 500)
  }

  async flush(): Promise<void> {
    if (!this.dirty) return
    this.dirty = false
    const data: StoreData = {}
    for (const [key, record] of this.store) {
      data[key] = record
    }
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  private scopedKey(userId: string, key: DeviceConfigKey): string {
    return `${userId}::${makeDeviceKey(key)}`
  }

  get(userId: string, key: DeviceConfigKey): DeviceConfigRecord | null {
    const found = this.store.get(this.scopedKey(userId, key))
    if (!found) return null
    return { ...found, config: { ...found.config } }
  }

  getBySerial(userId: string, serial: string): DeviceConfigRecord | null {
    const prefix = `${userId}::${serial}::`
    for (const [key, record] of this.store) {
      if (key.startsWith(prefix)) {
        return { ...record, config: { ...record.config } }
      }
    }
    return null
  }

  upsert(userId: string, key: DeviceConfigKey, config: DeviceConnectConfig): DeviceConfigRecord {
    const record: DeviceConfigRecord = { ...key, config: { ...config } }
    this.store.set(this.scopedKey(userId, key), record)
    this.scheduleSave()
    return { ...record, config: { ...record.config } }
  }

  destroy(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
  }
}
