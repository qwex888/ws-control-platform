import { describe, expect, it } from 'vitest'
import { loadDeviceConfig, makeDeviceKey, saveDeviceConfig } from '../device/config'

describe('device config', () => {
  it('uses serial+transportId as key', () => {
    expect(makeDeviceKey({ serial: 'A', transportId: 1 })).toBe('A::1')
  })

  it('updates config permanently by replacing latest value', () => {
    const initial = new Map<string, { fps?: number }>()
    const key = 'A::1'
    const afterFirst = saveDeviceConfig(initial, key, { fps: 30 })
    const afterSecond = saveDeviceConfig(afterFirst, key, { fps: 60 })

    expect(loadDeviceConfig(afterSecond, key)?.fps).toBe(60)
    expect(loadDeviceConfig(afterFirst, key)?.fps).toBe(30)
  })
})
