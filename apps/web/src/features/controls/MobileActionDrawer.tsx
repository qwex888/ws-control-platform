import { useCallback, useRef, useState } from 'react'
import { Send, Unplug } from 'lucide-react'
import { DEFAULT_DEVICE_CONFIG, type WsMessage } from '@wsctl/core'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Slider } from '../../components/ui/slider'
import { Separator } from '../../components/ui/separator'
import { MOBILE_ACTIONS } from './mobileActions'
import { BlindPinPad } from './BlindPinPad'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  send: (msg: WsMessage) => void
  onDisconnect: () => void
}

function formatBitrate(bps: number): string {
  return `${(bps / 1_000_000).toFixed(1)}M`
}

export function MobileActionDrawer({ open, onOpenChange, send, onDisconnect }: Props) {
  const [bitrate, setBitrate] = useState(DEFAULT_DEVICE_CONFIG.bitrate)
  const [fps, setFps] = useState(DEFAULT_DEVICE_CONFIG.fps)
  const [textInput, setTextInput] = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

  const handleAction = useCallback(
    (id: string) => {
      send({ event: 'control/action', data: { action: id } })
    },
    [send]
  )

  const handleDisconnect = () => {
    onOpenChange(false)
    onDisconnect()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>操作面板</SheetTitle>
        </SheetHeader>

        <div className="grid gap-4 overflow-auto px-4 pb-6 pt-2">
          <div className="grid grid-cols-4 gap-2">
            {MOBILE_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleAction(action.id)}
                className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-muted-foreground transition-colors active:bg-secondary"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <action.icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px]">{action.label}</span>
              </button>
            ))}
          </div>

          <Separator />

          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">PIN 盲输</span>
            <p className="text-[11px] text-muted-foreground/70">安全界面黑屏时，可盲输数字 PIN 解锁</p>
            <BlindPinPad send={send} />
          </div>

          <Separator />

          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">文本输入</span>
            <div className="flex gap-1.5">
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && textInput.trim()) {
                    send({ event: 'input/text', data: { text: textInput } })
                    setTextInput('')
                  }
                }}
                placeholder="输入文本..."
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!textInput.trim()}
                onClick={() => {
                  if (textInput.trim()) {
                    send({ event: 'input/text', data: { text: textInput } })
                    setTextInput('')
                    textInputRef.current?.focus()
                  }
                }}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">快捷设置</span>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">码率</Label>
                <span className="text-xs font-mono text-muted-foreground">{formatBitrate(bitrate)}</span>
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
                <Label className="text-xs">帧率</Label>
                <span className="text-xs font-mono text-muted-foreground">{fps} fps</span>
              </div>
              <Slider
                min={1}
                max={120}
                step={1}
                value={[fps]}
                onValueChange={([v]) => setFps(v!)}
              />
            </div>
          </div>

          <Separator />

          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleDisconnect}
          >
            <Unplug className="h-4 w-4" />
            断开连接
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
