import Adb from 'adbkit'

let clientInstance: ReturnType<typeof Adb.createClient> | null = null

export function getAdbClient() {
  if (!clientInstance) {
    const host = process.env.ADB_HOST ?? '127.0.0.1'
    const port = Number(process.env.ADB_PORT ?? 5037)
    clientInstance = Adb.createClient({ host, port })
  }
  return clientInstance
}

export type AdbDevice = {
  id: string
  type: string
}

export async function listDevices(): Promise<AdbDevice[]> {
  const client = getAdbClient()
  const devices = await client.listDevices()
  return devices.map((d: { id: string; type: string }) => ({
    id: d.id,
    type: d.type,
  }))
}

export async function getDeviceProperties(serial: string): Promise<Record<string, string>> {
  const client = getAdbClient()
  return client.getProperties(serial)
}
