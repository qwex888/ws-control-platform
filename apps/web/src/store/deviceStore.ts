import { create } from 'zustand'

export type DeviceStatus = 'online' | 'offline' | 'connecting'

export interface DeviceInfo {
  serial: string
  transportId: string | number
  name: string
  status: DeviceStatus
}

interface DeviceState {
  devices: DeviceInfo[]
  selectedDeviceKey: string | null
  videoSize: { width: number; height: number }
  setDevices: (devices: DeviceInfo[]) => void
  selectDevice: (key: string | null) => void
  updateDeviceStatus: (serial: string, status: DeviceStatus) => void
  setVideoSize: (width: number, height: number) => void
}

export const makeDeviceKey = (d: { serial: string; transportId: string | number }) =>
  `${d.serial}::${d.transportId}`

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  selectedDeviceKey: null,
  videoSize: { width: 1080, height: 1920 },
  setDevices: (devices) => set({ devices }),
  selectDevice: (key) => set({ selectedDeviceKey: key }),
  updateDeviceStatus: (serial, status) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.serial === serial ? { ...d, status } : d
      ),
    })),
  setVideoSize: (width, height) => set({ videoSize: { width, height } }),
}))
