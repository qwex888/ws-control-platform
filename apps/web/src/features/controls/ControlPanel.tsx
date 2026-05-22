import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Home, ArrowLeft, LayoutGrid, AppWindow, Power, RotateCw,
  Camera, Volume1, Volume2, Copy, ClipboardPaste, Languages, Send, ALargeSmall,
} from 'lucide-react'
import type { WsMessage } from '@wsctl/core'
import { Button } from '../../components/ui/button'
import { Switch } from '../../components/ui/switch'
import { Label } from '../../components/ui/label'
import { Separator } from '../../components/ui/separator'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'
import {
  resolveClipboardEnabled,
  setGlobalClipboardDefault,
  setSessionClipboardOverride,
} from '../clipboard/clipboardPolicyStore'
import { BlindPinPad } from './BlindPinPad'

const DEMO_SESSION_ID = 'demo-session'

type ControlDef = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: string
}

const CONTROLS: ControlDef[] = [
  { id: 'home', label: 'Home', icon: Home, group: 'nav' },
  { id: 'back', label: 'Back', icon: ArrowLeft, group: 'nav' },
  { id: 'recent', label: 'Recent', icon: LayoutGrid, group: 'nav' },
  { id: 'menu', label: 'Menu', icon: AppWindow, group: 'nav' },
  { id: 'power', label: 'Power', icon: Power, group: 'system' },
  { id: 'rotate', label: 'Rotate', icon: RotateCw, group: 'system' },
  { id: 'screenshot', label: 'Screenshot', icon: Camera, group: 'system' },
  { id: 'vol-up', label: 'Vol+', icon: Volume2, group: 'volume' },
  { id: 'vol-down', label: 'Vol-', icon: Volume1, group: 'volume' },
  { id: 'copy', label: 'Copy', icon: Copy, group: 'clipboard' },
  { id: 'paste', label: 'Paste', icon: ClipboardPaste, group: 'clipboard' },
  { id: 'ime-switch', label: '切换输入法', icon: Languages, group: 'input' },
  { id: 'lang-toggle', label: '切换中英文', icon: ALargeSmall, group: 'input' },
]

const GROUP_LABELS: Record<string, string> = {
  nav: '导航',
  system: '系统',
  volume: '音量',
  clipboard: '剪贴板',
  input: '输入',
}

type Props = {
  send: (msg: WsMessage) => void
}

function ControlGroup({ group, controls, onAction }: {
  group: string
  controls: ControlDef[]
  onAction: (id: string) => void
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {GROUP_LABELS[group] ?? group}
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {controls.map((ctrl) => (
          <Tooltip key={ctrl.id}>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 justify-start gap-2"
                onClick={() => onAction(ctrl.id)}
                aria-label={ctrl.label}
              >
                <ctrl.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs">{ctrl.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{ctrl.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

export function ControlPanel({ send }: Props) {
  const [globalOn, setGlobalOn] = useState(true)
  const [sessionOverride, setSessionOverride] = useState<boolean | undefined>(undefined)
  const [textInput, setTextInput] = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

  const effective = useMemo(
    () => resolveClipboardEnabled(DEMO_SESSION_ID),
    [globalOn, sessionOverride]
  )

  const groups = useMemo(() => {
    const map = new Map<string, ControlDef[]>()
    for (const ctrl of CONTROLS) {
      const list = map.get(ctrl.group) ?? []
      list.push(ctrl)
      map.set(ctrl.group, list)
    }
    return map
  }, [])

  const handleAction = useCallback(
    (id: string) => {
      send({ event: 'control/action', data: { action: id } })
    },
    [send]
  )

  const handleClipboardPolicyChange = useCallback(
    (enabled: boolean) => {
      send({ event: 'clipboard/policy', data: { enabled } })
    },
    [send]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">控制面板</h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="grid gap-5 p-4">
          {Array.from(groups.entries()).map(([group, ctrls]) => (
            <ControlGroup key={group} group={group} controls={ctrls} onAction={handleAction} />
          ))}

          <Separator />

          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              PIN 盲输
            </span>
            <p className="text-[10px] text-muted-foreground/60">
              安全界面黑屏时，可盲输数字 PIN 解锁
            </p>
            <BlindPinPad send={send} />
          </div>

          <Separator />

          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              文本输入
            </span>
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
                placeholder="输入文本发送到设备..."
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="left">发送文本</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              支持中文等非 ASCII 文本，通过剪贴板粘贴到设备
            </p>
          </div>

          <Separator />

          <div className="grid gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              剪贴板同步
            </span>
            <div className="flex items-center justify-between">
              <Label htmlFor="clip-global" className="text-xs text-muted-foreground">
                全局同步
              </Label>
              <Switch
                id="clip-global"
                checked={globalOn}
                onCheckedChange={(checked) => {
                  setGlobalOn(checked)
                  setGlobalClipboardDefault(checked)
                  handleClipboardPolicyChange(checked)
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clip-session" className="text-xs text-muted-foreground">
                会话覆盖
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="clip-session"
                  checked={sessionOverride ?? false}
                  onCheckedChange={(checked) => {
                    setSessionOverride(checked)
                    setSessionClipboardOverride(DEMO_SESSION_ID, checked)
                  }}
                />
                {sessionOverride !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setSessionOverride(undefined)
                      setSessionClipboardOverride(DEMO_SESSION_ID, undefined)
                    }}
                    className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60">
              状态: {effective ? '已启用' : '已禁用'}
              {sessionOverride === undefined ? ' (全局)' : ' (会话覆盖)'}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
