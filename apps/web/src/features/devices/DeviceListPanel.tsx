import { RefreshCw, Settings, Smartphone, Plus, Wifi, Trash2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Separator } from '../../components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'
import { useDeviceStore, makeDeviceKey, type DeviceInfo } from '../../store/deviceStore'
import { useLayoutStore } from '../../store/layoutStore'
import { DeviceConfigDialog } from './DeviceConfigDialog'
import { DeviceConfigSheet } from './DeviceConfigSheet'
import { AddDeviceDialog } from './AddDeviceDialog'
import { AddDeviceSheet } from './AddDeviceSheet'
import { DEFAULT_DEVICE_CONFIG } from '@wsctl/core'
import { useDeviceConfig, type DeviceConfig } from './useDeviceConfig'
import { useAdbStatus } from './useAdbStatus'
import { cn } from '../../lib/utils'

function DeviceCard({ device, selected, onSelect, onSettings, onDelete }: {
  device: DeviceInfo
  selected: boolean
  onSelect: () => void
  onSettings: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const key = makeDeviceKey(device)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-200 cursor-pointer',
        selected
          ? 'border-primary/50 bg-primary/5'
          : 'border-transparent hover:bg-secondary'
      )}
      aria-label={`Select device ${device.name}`}
      aria-pressed={selected}
      data-device-key={key}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
        {device.serial.includes(':') ? (
          <Wifi className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Smartphone className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{device.name}</span>
          <div className="flex items-center gap-1">
            <Badge
              variant={
                device.status === 'online'
                  ? 'success'
                  : device.status === 'connecting' || device.status === 'recovering'
                    ? 'warning'
                    : device.status === 'unauthorized'
                      ? 'warning'
                      : 'secondary'
              }
              className="shrink-0 text-[10px]"
            >
              {device.status === 'online'
                ? '在线'
                : device.status === 'connecting'
                  ? '连接中'
                  : device.status === 'recovering'
                    ? '恢复中'
                    : device.status === 'unauthorized'
                      ? '待授权'
                      : '离线'}
            </Badge>
            <div
              role="button"
              tabIndex={0}
              onClick={onSettings}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSettings(e as unknown as React.MouseEvent) } }}
              className="shrink-0 rounded p-1 hover:bg-secondary cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              aria-label="设备设置"
            >
              <Settings className="h-3.5 w-3.5" />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={onDelete}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDelete(e as unknown as React.MouseEvent) } }}
              className="shrink-0 rounded p-1 hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
              aria-label="删除设备"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
        <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
          {device.serial}
        </span>
      </div>
    </div>
  )
}

type Props = {
  onDeviceSelect: (serial: string, config?: DeviceConfig) => void
  onRefresh: () => void
  refreshing?: boolean
}

export function DeviceListPanel({ onDeviceSelect, onRefresh, refreshing = false }: Props) {
  const devices = useDeviceStore((s) => s.devices)
  const selectedDeviceKey = useDeviceStore((s) => s.selectedDeviceKey)
  const selectDevice = useDeviceStore((s) => s.selectDevice)
  const isMobile = useLayoutStore((s) => s.isMobile)
  const [configOpen, setConfigOpen] = useState(false)
  const [configTarget, setConfigTarget] = useState<DeviceInfo | null>(null)
  const [currentConfig, setCurrentConfig] = useState<DeviceConfig>({ ...DEFAULT_DEVICE_CONFIG })
  const { fetchConfig, saveConfig, loading } = useDeviceConfig()
  const { status: adbStatus, connectDevice, removeDevice } = useAdbStatus()
  const [addDeviceOpen, setAddDeviceOpen] = useState(false)

  const handleRefresh = () => {
    onRefresh()
  }

  const openConfig = useCallback(async (device: DeviceInfo) => {
    setConfigTarget(device)
    const config = await fetchConfig(device.serial)
    setCurrentConfig(config)
    setConfigOpen(true)
  }, [fetchConfig])

  const handleSelect = useCallback(
    async (device: DeviceInfo) => {
      const key = makeDeviceKey(device)
      selectDevice(key)

      if (device.status === 'unauthorized') {
        const config = await fetchConfig(device.serial)
        onDeviceSelect(device.serial, config)
        return
      }

      openConfig(device)
    },
    [selectDevice, openConfig, fetchConfig, onDeviceSelect],
  )

  const handleSettingsClick = useCallback((e: React.MouseEvent, device: DeviceInfo) => {
    e.stopPropagation()
    openConfig(device)
  }, [openConfig])

  const handleDeleteClick = useCallback(async (e: React.MouseEvent, device: DeviceInfo) => {
    e.stopPropagation()
    const result = await removeDevice(device.serial)
    if (result.success) {
      toast.success(`已移除设备 ${device.name}`)
      setTimeout(() => onRefresh(), 300)
    } else {
      toast.error('移除设备失败', { description: result.message })
    }
  }, [removeDevice, onRefresh])

  const handleConfigConfirm = useCallback(async (config: DeviceConfig) => {
    if (!configTarget) return
    await saveConfig(configTarget.serial, config)
    setConfigOpen(false)
    onDeviceSelect(configTarget.serial, config)
  }, [configTarget, saveConfig, onDeviceSelect])

  const configProps = {
    open: configOpen,
    onOpenChange: setConfigOpen,
    deviceName: configTarget?.name ?? '',
    initialConfig: currentConfig,
    onConfirm: handleConfigConfirm,
    loading,
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">设备列表</h2>
        <div className="flex gap-1">
          {adbStatus?.cliAvailable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAddDeviceOpen(true)}
                  aria-label="添加无线设备"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>添加无线设备</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            aria-label="刷新设备列表"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="grid gap-1 p-2">
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">暂无设备</p>
                <p className="mt-1 text-xs text-muted-foreground/60">连接 ADB 设备后将自动显示</p>
              </div>
            </div>
          ) : (
            devices.map((device) => {
              const key = makeDeviceKey(device)
              return (
                <DeviceCard
                  key={key}
                  device={device}
                  selected={selectedDeviceKey === key}
                  onSelect={() => handleSelect(device)}
                  onSettings={(e) => handleSettingsClick(e, device)}
                  onDelete={(e) => handleDeleteClick(e, device)}
                />
              )
            })
          )}
        </div>
      </ScrollArea>

      {isMobile ? (
        <DeviceConfigSheet {...configProps} />
      ) : (
        <DeviceConfigDialog {...configProps} />
      )}

      {isMobile ? (
        <AddDeviceSheet
          open={addDeviceOpen}
          onOpenChange={setAddDeviceOpen}
          onConnect={async (host, port) => {
            const result = await connectDevice(host, port)
            if (result.success) {
              setTimeout(() => onRefresh(), 500)
            }
            return result
          }}
        />
      ) : (
        <AddDeviceDialog
          open={addDeviceOpen}
          onOpenChange={setAddDeviceOpen}
          onConnect={async (host, port) => {
            const result = await connectDevice(host, port)
            if (result.success) {
              setTimeout(() => onRefresh(), 500)
            }
            return result
          }}
        />
      )}
    </div>
  )
}
