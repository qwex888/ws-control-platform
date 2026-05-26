import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { DeviceConnectStatus, WsMessage } from '@wsctl/core'
import { useDeviceStore, mapAdbTypeToStatus, type DeviceInfo, type DeviceStatus } from '../../store/deviceStore'

const REFRESH_TIMEOUT_MS = 5000
const AUTH_POLL_INTERVAL_MS = 3000

const PROGRESS_TOAST: Partial<Record<DeviceConnectStatus, { message: string; description?: string }>> = {
  checking: { message: '正在检测设备状态…' },
  waiting_auth: {
    message: '等待设备授权',
    description: '请在设备屏幕上点击「允许 USB 调试」',
  },
  recovering: {
    message: '正在尝试恢复连接…',
    description: '请稍候，或检查 USB / 无线连接',
  },
  cleaning: { message: '正在清理环境…' },
  pushing: { message: '正在推送投屏服务…' },
  starting: { message: '正在启动投屏服务…' },
  connecting: { message: '正在建立视频连接…' },
}

const IN_PROGRESS_STATUSES: DeviceConnectStatus[] = [
  'checking',
  'waiting_auth',
  'recovering',
  'cleaning',
  'pushing',
  'starting',
  'connecting',
]

function connectStatusToDeviceStatus(status: DeviceConnectStatus): DeviceStatus {
  if (status === 'waiting_auth') return 'unauthorized'
  if (status === 'recovering') return 'recovering'
  if (IN_PROGRESS_STATUSES.includes(status)) return 'connecting'
  if (status === 'connected') return 'online'
  if (status === 'failed') return 'offline'
  return 'connecting'
}

export function useDeviceList() {
  const setDevices = useDeviceStore((s) => s.setDevices)
  const updateDeviceStatus = useDeviceStore((s) => s.updateDeviceStatus)
  const setStreamLost = useDeviceStore((s) => s.setStreamLost)
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sendRef = useRef<((msg: WsMessage) => void) | null>(null)

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = null
    }
  }, [])

  const stopAuthPoll = useCallback(() => {
    if (authPollRef.current) {
      clearInterval(authPollRef.current)
      authPollRef.current = null
    }
  }, [])

  const startAuthPoll = useCallback((send: (msg: WsMessage) => void) => {
    sendRef.current = send
    if (authPollRef.current) return
    authPollRef.current = setInterval(() => {
      const devices = useDeviceStore.getState().devices
      const hasUnauthorized = devices.some((d) => d.status === 'unauthorized')
      if (hasUnauthorized && sendRef.current) {
        sendRef.current({ event: 'device/list' })
      } else if (!hasUnauthorized && authPollRef.current) {
        clearInterval(authPollRef.current)
        authPollRef.current = null
      }
    }, AUTH_POLL_INTERVAL_MS)
  }, [])

  useEffect(() => stopAuthPoll, [stopAuthPoll])

  const handleWsMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.event === 'device/list') {
        const data = msg.data as { devices: Array<{ id: string; type: string; name?: string }> }
        const prev = useDeviceStore.getState().devices
        const devices: DeviceInfo[] = data.devices.map((d) => {
          const existing = prev.find((p) => p.serial === d.id)
          return {
            serial: d.id,
            transportId: d.id,
            name: d.name ?? d.id,
            adbType: d.type,
            status: mapAdbTypeToStatus(d.type, existing?.status),
          }
        })
        setDevices(devices)

        const hasUnauthorized = devices.some((d) => d.status === 'unauthorized')
        if (hasUnauthorized && sendRef.current) {
          startAuthPoll(sendRef.current)
        }

        if (refreshTimer.current) {
          clearRefreshTimer()
          setRefreshing(false)
          if (devices.length > 0) {
            toast.success(`刷新成功，发现 ${devices.length} 台设备`)
          } else {
            toast.info('未发现 ADB 设备', {
              description: '请确认设备已通过 USB 连接并启用了调试模式',
            })
          }
        }
      }

      if (msg.event === 'device/connect') {
        const data = msg.data as {
          status: DeviceConnectStatus
          serial: string
          reason?: string
          suggestion?: string
        }
        const { status, serial, reason, suggestion } = data
        const toastId = `connect-${serial}`

        if (status === 'connected') {
          updateDeviceStatus(serial, 'online')
          setStreamLost(false)
          toast.success(`已连接 ${serial}`, { id: toastId })
          return
        }

        if (status === 'failed') {
          updateDeviceStatus(serial, 'offline')
          toast.error(`连接失败: ${serial}`, {
            id: toastId,
            description: suggestion ?? reason ?? '请检查设备状态',
          })
          return
        }

        updateDeviceStatus(serial, connectStatusToDeviceStatus(status))

        const progress = PROGRESS_TOAST[status]
        if (progress) {
          toast.loading(progress.message, {
            id: toastId,
            description: progress.description ?? suggestion,
          })
        }
      }

      if (msg.event === 'device/stream-lost') {
        const data = msg.data as { serial: string; stream: string }
        setStreamLost(true)
        updateDeviceStatus(data.serial, 'offline')
        toast.error('设备连接已中断', {
          id: `stream-lost-${data.serial}`,
          description: '可点击画面上的「重新连接」恢复投屏',
        })
      }

      if (msg.event === 'error') {
        const data = msg.data as { code?: string; reason?: string }
        if (data.code === 'RESUME_FAILED') {
          console.debug('[ws] 会话恢复失败，已自动创建新会话')
          return
        }
        toast.error(`错误: ${data.code ?? 'UNKNOWN'}`, {
          description: data.reason,
        })
      }
    },
    [setDevices, updateDeviceStatus, clearRefreshTimer, setStreamLost, startAuthPoll]
  )

  const requestDeviceList = useCallback(
    (send: (msg: WsMessage) => void) => {
      sendRef.current = send
      send({ event: 'device/list' })
    },
    []
  )

  const refreshDeviceList = useCallback(
    (send: (msg: WsMessage) => void) => {
      clearRefreshTimer()
      setRefreshing(true)
      send({ event: 'device/list' })

      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null
        setRefreshing(false)
        toast.error('刷新设备列表超时', { description: '请检查后端服务是否正常运行' })
      }, REFRESH_TIMEOUT_MS)
    },
    [clearRefreshTimer]
  )

  return { handleWsMessage, requestDeviceList, refreshDeviceList, refreshing, updateDeviceStatus, startAuthPoll, stopAuthPoll }
}
