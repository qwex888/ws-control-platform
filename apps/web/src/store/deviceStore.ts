import { create } from 'zustand'
import type { DeviceConnectConfig } from '@wsctl/core'

export type DeviceStatus = 'online' | 'offline' | 'connecting' | 'unauthorized' | 'recovering'

export interface DeviceInfo {
  serial: string
  transportId: string | number
  name: string
  status: DeviceStatus
  adbType?: string
}

export type LastConnectInfo = {
  serial: string
  config?: DeviceConnectConfig
}

interface DeviceState {
  devices: DeviceInfo[]
  selectedDeviceKey: string | null
  videoSize: { width: number; height: number }
  streamLost: boolean
  lastConnect: LastConnectInfo | null
  setDevices: (devices: DeviceInfo[]) => void
  selectDevice: (key: string | null) => void
  updateDeviceStatus: (serial: string, status: DeviceStatus) => void
  setVideoSize: (width: number, height: number) => void
  setStreamLost: (lost: boolean) => void
  setLastConnect: (info: LastConnectInfo | null) => void
}

function mapAdbTypeToStatus(adbType: string, current?: DeviceStatus): DeviceStatus {
  if (current === 'connecting' || current === 'recovering') return current
  if (adbType === 'device') return 'online'
  if (adbType === 'unauthorized') return 'unauthorized'
  return 'offline'
}

export const makeDeviceKey = (d: { serial: string; transportId: string | number }) =>
  `${d.serial}::${d.transportId}`

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  selectedDeviceKey: null,
  videoSize: { width: 1080, height: 1920 },
  streamLost: false,
  lastConnect: null,
  setDevices: (devices) => set({ devices }),
  selectDevice: (key) => set({ selectedDeviceKey: key, streamLost: false }),
  updateDeviceStatus: (serial, status) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.serial === serial ? { ...d, status } : d
      ),
    })),
  setVideoSize: (width, height) => set({ videoSize: { width, height } }),
  setStreamLost: (lost) => set({ streamLost: lost }),
  setLastConnect: (info) => set({ lastConnect: info }),
}))

export { mapAdbTypeToStatus }
