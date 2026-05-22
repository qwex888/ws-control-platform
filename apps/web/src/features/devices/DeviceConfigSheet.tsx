import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Slider } from '../../components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import type { DeviceConfig } from './useDeviceConfig'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceName: string
  initialConfig: DeviceConfig
  onConfirm: (config: DeviceConfig) => void
  loading?: boolean
}

function formatBitrate(bps: number): string {
  return `${(bps / 1_000_000).toFixed(1)} Mbps`
}

export function DeviceConfigSheet({
  open,
  onOpenChange,
  deviceName,
  initialConfig,
  onConfirm,
  loading,
}: Props) {
  const [fps, setFps] = useState(initialConfig.fps)
  const [bitrate, setBitrate] = useState(initialConfig.bitrate)
  const [maxSize, setMaxSize] = useState(initialConfig.maxSize)
  const [orientationLock, setOrientationLock] = useState<'portrait' | 'landscape' | 'free'>(
    initialConfig.orientationLock
  )
  const [captureMode, setCaptureMode] = useState<'mirror' | 'virtual_display'>(
    initialConfig.captureMode
  )
  const [virtualDisplay, setVirtualDisplay] = useState(initialConfig.virtualDisplay)
  const [secureCaptureMode, setSecureCaptureMode] = useState<'default' | 'root_server'>(
    initialConfig.secureCaptureMode
  )

  useEffect(() => {
    if (open) {
      setFps(initialConfig.fps)
      setBitrate(initialConfig.bitrate)
      setMaxSize(initialConfig.maxSize)
      setOrientationLock(initialConfig.orientationLock)
      setCaptureMode(initialConfig.captureMode)
      setVirtualDisplay(initialConfig.virtualDisplay)
      setSecureCaptureMode(initialConfig.secureCaptureMode)
    }
  }, [open, initialConfig])

  const handleConfirm = () => {
    onConfirm({ fps, bitrate, maxSize, orientationLock, captureMode, virtualDisplay, secureCaptureMode })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>连接配置</SheetTitle>
          <SheetDescription>
            为 {deviceName} 设置连接参数
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 overflow-auto px-4 pb-6 pt-4">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>分辨率</Label>
              <span className="text-sm font-mono text-muted-foreground">{maxSize}p</span>
            </div>
            <Slider
              min={480}
              max={2160}
              step={120}
              value={[maxSize]}
              onValueChange={([v]) => setMaxSize(v!)}
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>码率</Label>
              <span className="text-sm font-mono text-muted-foreground">{formatBitrate(bitrate)}</span>
            </div>
            <Slider
              min={500_000}
              max={20_000_000}
              step={500_000}
              value={[bitrate]}
              onValueChange={([v]) => setBitrate(v!)}
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>帧率</Label>
              <span className="text-sm font-mono text-muted-foreground">{fps} fps</span>
            </div>
            <Slider
              min={1}
              max={120}
              step={1}
              value={[fps]}
              onValueChange={([v]) => setFps(v!)}
            />
          </div>

          <div className="grid gap-3">
            <Label>方向锁定</Label>
            <Select value={orientationLock} onValueChange={(v) => setOrientationLock(v as 'portrait' | 'landscape' | 'free')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">自由旋转</SelectItem>
                <SelectItem value="portrait">竖屏锁定</SelectItem>
                <SelectItem value="landscape">横屏锁定</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <Label>采集模式</Label>
            <Select value={captureMode} onValueChange={(v) => setCaptureMode(v as 'mirror' | 'virtual_display')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mirror">镜像（默认）</SelectItem>
                <SelectItem value="virtual_display">虚拟屏</SelectItem>
              </SelectContent>
            </Select>
            {captureMode === 'virtual_display' && (
              <p className="text-[10px] text-muted-foreground/60">
                虚拟屏模式下 App 在独立 Display 运行，不镜像物理屏幕。适合已解锁设备的 App 远控。
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <Label>安全界面处理</Label>
            <Select value={secureCaptureMode} onValueChange={(v) => setSecureCaptureMode(v as 'default' | 'root_server')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认</SelectItem>
                <SelectItem value="root_server">Root 启动（实验性）</SelectItem>
              </SelectContent>
            </Select>
            {secureCaptureMode === 'root_server' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                ⚠ 需已 Root 设备，不保证所有场景有效
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={loading}>
              {loading ? '保存中...' : '连接'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
