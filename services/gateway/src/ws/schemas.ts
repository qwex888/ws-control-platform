import { z } from 'zod'

export const wsMessageSchema = z.object({
  event: z.string().min(1).max(64),
  data: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().max(64).optional(),
})

export const touchEventSchema = z.object({
  action: z.enum(['down', 'up', 'move']),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  pointerId: z.number().int().optional(),
  pressure: z.number().min(0).max(1).optional(),
})

export const keyEventSchema = z.object({
  code: z.string().min(1).max(32),
  action: z.enum(['down', 'up']),
})

export const controlActionSchema = z.object({
  action: z.enum([
    'home', 'back', 'menu', 'recent',
    'power', 'vol-up', 'vol-down',
    'rotate', 'screenshot', 'copy', 'paste',
  ]),
})

export const deviceConnectSchema = z.object({
  serial: z.string().min(1).max(128),
  transportId: z.union([z.string().min(1), z.number().int().nonnegative()]),
  config: z.object({
    fps: z.number().int().min(1).max(240).optional(),
    bitrate: z.number().int().min(100_000).max(100_000_000).optional(),
    maxSize: z.number().int().min(128).max(8192).optional(),
  }).optional(),
})

export const clipboardPolicySchema = z.object({
  enabled: z.boolean(),
})
