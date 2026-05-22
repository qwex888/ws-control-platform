import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog'
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

export function DeviceConfigDialog({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm({ fps, bitrate, maxSize, orientationLock, captureMode, virtualDisplay, secureCaptureMode })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>连接配置</DialogTitle>
          <DialogDescription>
            为 {deviceName} 设置连接参数
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5 pt-2">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>分辨率 (Max Size)</Label>
              <span className="text-sm font-mono text-muted-foreground">{maxSize}p</span>
            </div>
            <Slider
              min={480}
              max={2160}
              step={120}
              value={[maxSize]}
              onValueChange={([v]) => setMaxSize(v!)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>480p</span>
              <span>1080p</span>
              <span>2160p</span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>码率 (Bitrate)</Label>
              <span className="text-sm font-mono text-muted-foreground">{formatBitrate(bitrate)}</span>
            </div>
            <Slider
              min={500_000}
              max={20_000_000}
              step={500_000}
              value={[bitrate]}
              onValueChange={([v]) => setBitrate(v!)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>0.5M</span>
              <span>10M</span>
              <span>20M</span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>帧率 (FPS)</Label>
              <span className="text-sm font-mono text-muted-foreground">{fps} fps</span>
            </div>
            <Slider
              min={1}
              max={120}
              step={1}
              value={[fps]}
              onValueChange={([v]) => setFps(v!)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>1</span>
              <span>60</span>
              <span>120</span>
            </div>
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
              <div className="grid gap-2">
                <input
                  type="text"
                  value={virtualDisplay}
                  onChange={(e) => setVirtualDisplay(e.target.value)}
                  placeholder="如 1080x2340/420（留空自动）"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground/60">
                  虚拟屏模式下 App 在独立 Display 运行，不镜像物理屏幕。适合已解锁设备的 App 远控，无法用于远程解锁。
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <Label>安全界面处理</Label>
            <Select value={secureCaptureMode} onValueChange={(v) => setSecureCaptureMode(v as 'default' | 'root_server')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认（Shell 权限）</SelectItem>
                <SelectItem value="root_server">Root 启动（实验性）</SelectItem>
              </SelectContent>
            </Select>
            {secureCaptureMode === 'root_server' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                ⚠ 需设备已 Root。通过 su 启动 scrcpy-server，可能绕过部分 FLAG_SECURE 限制，但不保证所有 ROM 和 App 有效。
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '连接'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
