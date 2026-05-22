import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Monitor, ShieldAlert } from 'lucide-react'
import type { WsMessage } from '@wsctl/core'
import { useKeyboardBridge, type HidKeyEventPayload } from '../input/useKeyboardBridge'
import { useTouchBridge } from '../input/useTouchBridge'
import { calcFitRect } from './fitRect'
import { useDeviceStore } from '../../store/deviceStore'
import { cn } from '../../lib/utils'
import type { CanvasRenderer } from './canvasRenderer'

type Props = {
  send: (msg: WsMessage) => void
  rendererRef: RefObject<CanvasRenderer>
  noPadding?: boolean
}

export function DeviceCanvas({ send, rendererRef, noPadding }: Props) {
  const selectedDeviceKey = useDeviceStore((s) => s.selectedDeviceKey)
  const videoSize = useDeviceStore((s) => s.videoSize)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [secureScreen, setSecureScreen] = useState(false)

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.setSecureScreenListener(setSecureScreen)
    return () => renderer.setSecureScreenListener(null)
  }, [rendererRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Attach renderer via callback ref so it fires each time the <canvas> mounts/unmounts,
  // regardless of when containerSize or selectedDeviceKey settle.
  const canvasCallbackRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      ;(canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = node
      if (node) {
        rendererRef.current?.attach(node)
      } else {
        rendererRef.current?.detach()
      }
    },
    [rendererRef]
  )

  const fit = calcFitRect({
    containerW: containerSize.width,
    containerH: containerSize.height,
    frameW: videoSize.width,
    frameH: videoSize.height,
  })

  const sendHidKeyEvent = useCallback(
    (payload: HidKeyEventPayload) => {
      send({ event: 'input/key-hid', data: payload })
    },
    [send]
  )

  useKeyboardBridge(!!selectedDeviceKey, sendHidKeyEvent)

  useTouchBridge(
    canvasRef.current,
    videoSize.width,
    videoSize.height,
    !!selectedDeviceKey,
    useCallback(
      (payload) => {
        send({ event: 'input/touch', data: payload })
      },
      [send]
    ),
    useCallback(
      (payload) => {
        send({ event: 'input/scroll', data: payload })
      },
      [send]
    ),
  )

  const isConnected = !!selectedDeviceKey

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full items-center justify-center bg-background',
        noPadding ? '' : 'p-4'
      )}
      aria-label="Device canvas"
    >
      {isConnected && fit.width > 0 ? (
        <div className="relative">
          <canvas
            ref={canvasCallbackRef}
            width={videoSize.width}
            height={videoSize.height}
            tabIndex={0}
            className={cn(
              noPadding
                ? 'cursor-crosshair'
                : 'rounded-lg border border-border shadow-lg shadow-black/20 cursor-crosshair focus-visible:ring-2 focus-visible:ring-ring'
            )}
            style={{
              width: `${fit.width}px`,
              height: `${fit.height}px`,
            }}
          />
          {secureScreen && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center">
              <ShieldAlert className="h-8 w-8 text-amber-400" />
              <p className="text-sm font-medium text-white">安全界面，Android 禁止投屏</p>
              <p className="text-xs text-white/70">
                触摸与按键仍可操作 · 可使用下方 PIN 面板盲输密码
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary/50">
            <Monitor className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">选择设备开始控制</p>
            <p className="mt-1 text-xs text-muted-foreground/60">从左侧设备列表选择一个在线设备</p>
          </div>
        </div>
      )}
    </div>
  )
}
