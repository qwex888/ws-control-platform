export type DeviceIdentity = {
  serial: string
  transportId: string | number
}

export type CaptureMode = 'mirror' | 'virtual_display'

export type SecureCaptureMode = 'default' | 'root_server'

export type DeviceConnectConfig = {
  fps?: number
  bitrate?: number
  maxSize?: number
  orientationLock?: 'portrait' | 'landscape' | 'free'
  captureMode?: CaptureMode
  virtualDisplay?: string
  secureCaptureMode?: SecureCaptureMode
}

export type DeviceConfigStore = Map<string, DeviceConnectConfig>

export const DEFAULT_DEVICE_CONFIG = {
  fps: 24,
  bitrate: 8_000_000,
  maxSize: 1080,
  orientationLock: 'free' as const,
  captureMode: 'mirror' as CaptureMode,
  virtualDisplay: '',
  secureCaptureMode: 'default' as SecureCaptureMode,
} satisfies Required<DeviceConnectConfig>
