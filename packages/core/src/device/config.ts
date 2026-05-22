import type { DeviceConfigStore, DeviceConnectConfig, DeviceIdentity } from '../protocol/types'

export const makeDeviceKey = (device: DeviceIdentity): string => `${device.serial}::${device.transportId}`

export const loadDeviceConfig = (
  store: DeviceConfigStore,
  key: string,
): DeviceConnectConfig | undefined => store.get(key)

export const saveDeviceConfig = (
  store: DeviceConfigStore,
  key: string,
  config: DeviceConnectConfig,
): DeviceConfigStore => {
  const next = new Map(store)
  next.set(key, config)
  return next
}
