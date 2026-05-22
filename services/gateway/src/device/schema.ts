import { z } from 'zod'

export type DeviceConfigKey = {
  serial: string
  transportId: string | number
}

export type DeviceConnectConfig = {
  fps?: number
  bitrate?: number
  maxSize?: number
  orientationLock?: 'portrait' | 'landscape' | 'free'
  captureMode?: 'mirror' | 'virtual_display'
  virtualDisplay?: string
  secureCaptureMode?: 'default' | 'root_server'
  codecOptions?: string
  encoderName?: string
}

export type DeviceConfigRecord = DeviceConfigKey & {
  config: DeviceConnectConfig
}

export const makeDeviceKey = ({ serial, transportId }: DeviceConfigKey): string =>
  `${serial}::${transportId}`

export const deviceConfigSchema = z.object({
  fps: z.number().int().min(1).max(240).optional(),
  bitrate: z.number().int().min(100_000).max(100_000_000).optional(),
  maxSize: z.number().int().min(128).max(8192).optional(),
  orientationLock: z.enum(['portrait', 'landscape', 'free']).optional(),
  captureMode: z.enum(['mirror', 'virtual_display']).optional(),
  virtualDisplay: z.string().max(64).optional(),
  secureCaptureMode: z.enum(['default', 'root_server']).optional(),
  codecOptions: z.string().max(256).optional(),
  encoderName: z.string().max(128).optional(),
})

export const deviceConnectPayloadSchema = z.object({
  serial: z.string().min(1),
  transportId: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
  config: deviceConfigSchema.optional(),
})
