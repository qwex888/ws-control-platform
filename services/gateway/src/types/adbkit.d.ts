declare module 'adbkit' {
  interface AdbClient {
    listDevices(): Promise<Array<{ id: string; type: string }>>
    trackDevices(): Promise<DeviceTracker>
    getProperties(serial: string): Promise<Record<string, string>>
    push(serial: string, src: string, dest: string): Promise<Transfer>
    shell(serial: string, command: string): Promise<import('node:stream').Duplex>
    openLocal(serial: string, path: string): Promise<import('node:stream').Duplex>
    forward(serial: string, local: string, remote: string): Promise<void>
  }

  interface DeviceTracker {
    on(event: 'add', handler: (device: { id: string; type: string }) => void): void
    on(event: 'remove', handler: (device: { id: string; type: string }) => void): void
    on(event: 'change', handler: (device: { id: string; type: string }) => void): void
    on(event: 'end', handler: () => void): void
    end(): void
  }

  interface Transfer {
    on(event: 'end', handler: () => void): void
    on(event: 'error', handler: (err: Error) => void): void
  }

  function createClient(options?: { host?: string; port?: number }): AdbClient

  const _default: { createClient: typeof createClient }
  export default _default
}
