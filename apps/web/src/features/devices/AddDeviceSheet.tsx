import { useState } from 'react'
import { Loader2, Wifi } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (host: string, port: number) => Promise<{ success: boolean; message: string }>
}

export function AddDeviceSheet({ open, onOpenChange, onConnect }: Props) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('5555')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSubmit = async () => {
    const trimmedHost = host.trim()
    if (!trimmedHost) return

    const portNum = Number(port) || 5555
    setLoading(true)
    setResult(null)

    try {
      const res = await onConnect(trimmedHost, portNum)
      setResult(res)
      if (res.success) {
        setTimeout(() => {
          onOpenChange(false)
          setHost('')
          setPort('5555')
          setResult(null)
        }, 1500)
      }
    } catch (err) {
      setResult({ success: false, message: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            添加无线设备
          </SheetTitle>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-6 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="m-device-host" className="text-sm">
              IP 地址
            </Label>
            <input
              id="m-device-host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') handleSubmit()
              }}
              placeholder="192.168.1.100"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="m-device-port" className="text-sm">
              端口
            </Label>
            <input
              id="m-device-port"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') handleSubmit()
              }}
              placeholder="5555"
              min={1}
              max={65535}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground/60">
              默认 5555
            </p>
          </div>

          {result && (
            <div className={`rounded-md px-3 py-2 text-xs ${result.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
              {result.message}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading || !host.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              连接
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
