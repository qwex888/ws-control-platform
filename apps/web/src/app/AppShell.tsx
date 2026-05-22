import { useCallback, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Loader2, LogOut, Settings, User } from 'lucide-react'
import type { WsMessage } from '@wsctl/core'
import { DeviceListPanel } from '../features/devices/DeviceListPanel'
import { DeviceCanvas } from '../features/player/DeviceCanvas'
import { ControlPanel } from '../features/controls/ControlPanel'
import { MobileQuickActionBar, MobileToolbar } from '../features/controls'
import type { DeviceConfig } from '../features/devices/useDeviceConfig'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Separator } from '../components/ui/separator'
import { TooltipProvider } from '../components/ui/tooltip'
import { useConnectionStore } from '../store/connectionStore'
import { useDeviceStore } from '../store/deviceStore'
import { useLayoutStore } from '../store/layoutStore'
import { useWsConnection } from '../features/session/useWsConnection'
import { useDeviceList } from '../features/devices/useDeviceList'
import { H264Decoder } from '../features/player/h264Decoder'
import { CanvasRenderer } from '../features/player/canvasRenderer'

const MD_BREAKPOINT = 768

const statusConfig = {
  connected: { label: '已连接', variant: 'success' as const, Icon: Wifi },
  connecting: { label: '连接中', variant: 'warning' as const, Icon: Loader2 },
  disconnected: { label: '未连接', variant: 'destructive' as const, Icon: WifiOff },
}

export function AppShell() {
  const status = useConnectionStore((s) => s.status)
  const username = useConnectionStore((s) => s.username)
  const cfg = statusConfig[status]

  const setVideoSize = useDeviceStore((s) => s.setVideoSize)
  const selectedDeviceKey = useDeviceStore((s) => s.selectedDeviceKey)

  const isMobile = useLayoutStore((s) => s.isMobile)
  const mobileView = useLayoutStore((s) => s.mobileView)
  const setIsMobile = useLayoutStore((s) => s.setIsMobile)
  const setMobileView = useLayoutStore((s) => s.setMobileView)

  const rendererRef = useRef(new CanvasRenderer())
  const decoderRef = useRef<H264Decoder | null>(null)

  const { handleWsMessage, requestDeviceList } = useDeviceList()

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }
    handler(mql)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [setIsMobile])

  const onMessage = useCallback(
    (msg: WsMessage) => {
      handleWsMessage(msg)

      // On connect failure in mobile canvas view, go back to device list
      if (msg.event === 'device/connect') {
        const data = msg.data as { status?: string }
        if (data.status === 'failed') {
          const layout = useLayoutStore.getState()
          if (layout.isMobile && layout.mobileView === 'canvas') {
            useDeviceStore.getState().selectDevice(null)
            layout.setMobileView('list')
          }
        }
      }
    },
    [handleWsMessage]
  )

  const onBinary = useCallback((data: ArrayBuffer) => {
    decoderRef.current?.feed(data)
  }, [])

  const { send } = useWsConnection({ onMessage, onBinary })

  const sendRef = useRef(send)
  sendRef.current = send

  useEffect(() => {
    const decoder = new H264Decoder(
      (frame) => {
        rendererRef.current.drawFrame(frame)
      },
      (width, height) => {
        setVideoSize(width, height)
      }
    )
    decoder.start()
    decoderRef.current = decoder
    return () => decoder.stop()
  }, [setVideoSize])

  // On WS (re)connect, only refresh device list — do NOT auto-reconnect device.
  // Device connect is user-initiated via the config dialog flow.
  useEffect(() => {
    if (status === 'connected') {
      requestDeviceList(send)
    }
  }, [status, send, requestDeviceList])

  const handleDeviceSelect = useCallback(
    (serial: string, config?: DeviceConfig) => {
      sendRef.current({
        event: 'device/connect',
        data: { serial, config },
      })
      if (useLayoutStore.getState().isMobile) {
        useLayoutStore.getState().setMobileView('canvas')
      }
    },
    []
  )

  const handleDeviceRefresh = useCallback(() => {
    requestDeviceList(sendRef.current)
  }, [requestDeviceList])

  const handleMobileBack = useCallback(() => {
    sendRef.current({ event: 'device/disconnect' })
    useDeviceStore.getState().selectDevice(null)
    setMobileView('list')
  }, [setMobileView])

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  if (isMobile) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col bg-background">
          {mobileView === 'list' ? (
            <>
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">WS Control</span>
                  <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                    <cfg.Icon className={`h-3 w-3 ${status === 'connecting' ? 'animate-spin' : ''}`} />
                    {cfg.label}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </header>
              <div className="flex-1 overflow-auto">
                <DeviceListPanel
                  onDeviceSelect={handleDeviceSelect}
                  onRefresh={handleDeviceRefresh}
                />
              </div>
            </>
          ) : (
            <MobileCanvasView
              send={send}
              rendererRef={rendererRef}
              onBack={handleMobileBack}
            />
          )}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight">WS Control</span>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant={cfg.variant} className="gap-1">
              <cfg.Icon className={`h-3 w-3 ${status === 'connecting' ? 'animate-spin' : ''}`} />
              {cfg.label}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">{username ?? 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>我的账户</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4" />
                设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 border-r border-border">
            <DeviceListPanel
              onDeviceSelect={handleDeviceSelect}
              onRefresh={handleDeviceRefresh}
            />
          </aside>

          <main className="flex-1">
            <DeviceCanvas send={send} rendererRef={rendererRef} />
          </main>

          <aside className="w-80 shrink-0 border-l border-border">
            <ControlPanel send={send} />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  )
}

function MobileCanvasView({
  send,
  rendererRef,
  onBack,
}: {
  send: (msg: WsMessage) => void
  rendererRef: React.RefObject<CanvasRenderer>
  onBack: () => void
}) {
  const selectedDeviceKey = useDeviceStore((s) => s.selectedDeviceKey)
  const devices = useDeviceStore((s) => s.devices)
  const device = devices.find((d) => `${d.serial}::${d.transportId}` === selectedDeviceKey)

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <MobileToolbar
        deviceName={device?.name ?? '设备'}
        status={device?.status ?? 'offline'}
        onBack={onBack}
        send={send}
      />
      <div className="min-h-0 flex-1">
        <DeviceCanvas send={send} rendererRef={rendererRef} noPadding />
      </div>
      <MobileQuickActionBar send={send} />
    </div>
  )
}
