import { useCallback } from 'react'
import { toast } from 'sonner'
import type { WsMessage } from '@wsctl/core'
import { useDeviceStore, type DeviceInfo } from '../../store/deviceStore'

export function useDeviceList() {
  const setDevices = useDeviceStore((s) => s.setDevices)
  const updateDeviceStatus = useDeviceStore((s) => s.updateDeviceStatus)

  const handleWsMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.event === 'device/list') {
        const data = msg.data as { devices: Array<{ id: string; type: string; name?: string }> }
        const devices: DeviceInfo[] = data.devices.map((d) => ({
          serial: d.id,
          transportId: d.id,
          name: d.name ?? d.id,
          status: d.type === 'device' ? 'online' : 'offline',
        }))
        setDevices(devices)

        if (devices.length === 0) {
          toast.info('未发现 ADB 设备', {
            description: '请确认设备已通过 USB 连接并启用了调试模式',
          })
        }
      }

      if (msg.event === 'device/connect') {
        const data = msg.data as { status: string; serial: string; reason?: string }
        if (data.status === 'connecting') {
          updateDeviceStatus(data.serial, 'connecting')
          toast.loading(`正在连接 ${data.serial} ...`, { id: `connect-${data.serial}` })
        } else if (data.status === 'connected') {
          updateDeviceStatus(data.serial, 'online')
          toast.success(`已连接 ${data.serial}`, { id: `connect-${data.serial}` })
        } else if (data.status === 'failed') {
          updateDeviceStatus(data.serial, 'offline')
          toast.error(`连接失败: ${data.serial}`, {
            id: `connect-${data.serial}`,
            description: data.reason ?? '请检查设备状态',
          })
        }
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
    [setDevices, updateDeviceStatus]
  )

  const requestDeviceList = useCallback(
    (send: (msg: WsMessage) => void) => {
      send({ event: 'device/list' })
    },
    []
  )

  return { handleWsMessage, requestDeviceList, updateDeviceStatus }
}
