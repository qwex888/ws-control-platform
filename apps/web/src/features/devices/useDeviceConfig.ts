import { useCallback, useState } from 'react'
import { DEFAULT_DEVICE_CONFIG } from '@wsctl/core'
import { apiFetch } from '../../lib/api'

export type DeviceConfig = {
  fps: number
  bitrate: number
  maxSize: number
  orientationLock: 'portrait' | 'landscape' | 'free'
  captureMode: 'mirror' | 'virtual_display'
  virtualDisplay: string
  secureCaptureMode: 'default' | 'root_server'
}

const DEFAULT_CONFIG: DeviceConfig = { ...DEFAULT_DEVICE_CONFIG }

export function useDeviceConfig() {
  const [loading, setLoading] = useState(false)

  const fetchConfig = useCallback(async (serial: string): Promise<DeviceConfig> => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/device/config?serial=${encodeURIComponent(serial)}`)
      if (!res.ok) return { ...DEFAULT_CONFIG }
      const json = await res.json()
      if (json.success && json.data?.config) {
        return { ...DEFAULT_CONFIG, ...json.data.config }
      }
      return { ...DEFAULT_CONFIG }
    } catch {
      return { ...DEFAULT_CONFIG }
    } finally {
      setLoading(false)
    }
  }, [])

  const saveConfig = useCallback(async (serial: string, config: DeviceConfig): Promise<boolean> => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/device/config', {
        method: 'PUT',
        body: JSON.stringify({
          serial,
          transportId: serial,
          config,
        }),
      })
      return res.ok
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { fetchConfig, saveConfig, loading, DEFAULT_CONFIG }
}
