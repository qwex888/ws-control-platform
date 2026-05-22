import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'

export type AdbStatus = {
  serverAvailable: boolean
  cliAvailable: boolean
  cliPath: string | null
}

export function useAdbStatus() {
  const [status, setStatus] = useState<AdbStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/device/adb-status')
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setStatus(json.data)
          return
        }
      }
      setStatus(null)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const connectDevice = useCallback(async (host: string, port: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await apiFetch('/api/device/adb-connect', {
        method: 'POST',
        body: JSON.stringify({ host, port }),
      })
      const json = await res.json()
      return {
        success: json.success ?? false,
        message: json.data?.message ?? json.error ?? 'Unknown error',
      }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  }, [])

  return { status, loading, refresh, connectDevice }
}
