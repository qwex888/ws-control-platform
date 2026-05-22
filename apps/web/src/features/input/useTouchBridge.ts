import { useCallback, useRef, useEffect } from 'react'

export type TouchEventPayload = {
  action: 'down' | 'up' | 'move'
  x: number
  y: number
  width: number
  height: number
  pointerId: number
  pressure: number
}

export type ScrollEventPayload = {
  x: number
  y: number
  width: number
  height: number
  hscroll: number
  vscroll: number
  buttons: number
}

export type TouchBridgeSender = (payload: TouchEventPayload) => void
export type ScrollBridgeSender = (payload: ScrollEventPayload) => void

export function useTouchBridge(
  canvas: HTMLCanvasElement | null,
  deviceWidth: number,
  deviceHeight: number,
  enabled: boolean,
  send: TouchBridgeSender,
  sendScroll?: ScrollBridgeSender,
) {
  const sendRef = useRef(send)
  sendRef.current = send
  const sendScrollRef = useRef(sendScroll)
  sendScrollRef.current = sendScroll

  const mapCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = Math.round(((clientX - rect.left) / rect.width) * deviceWidth)
      const y = Math.round(((clientY - rect.top) / rect.height) * deviceHeight)
      return {
        x: Math.max(0, Math.min(x, deviceWidth)),
        y: Math.max(0, Math.min(y, deviceHeight)),
      }
    },
    [canvas, deviceWidth, deviceHeight]
  )

  useEffect(() => {
    if (!canvas || !enabled) return

    // Prevent browser scroll/zoom/pull-to-refresh on the canvas
    canvas.style.touchAction = 'none'

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      const pos = mapCoords(e.clientX, e.clientY)
      if (!pos) return
      sendRef.current({
        action: 'down',
        ...pos,
        width: deviceWidth,
        height: deviceHeight,
        pointerId: e.pointerId,
        pressure: e.pressure,
      })
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) return
      e.preventDefault()
      const pos = mapCoords(e.clientX, e.clientY)
      if (!pos) return
      sendRef.current({
        action: 'move',
        ...pos,
        width: deviceWidth,
        height: deviceHeight,
        pointerId: e.pointerId,
        pressure: e.pressure,
      })
    }

    const onPointerUp = (e: PointerEvent) => {
      const pos = mapCoords(e.clientX, e.clientY)
      if (!pos) return
      sendRef.current({
        action: 'up',
        ...pos,
        width: deviceWidth,
        height: deviceHeight,
        pointerId: e.pointerId,
        pressure: 0,
      })
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!sendScrollRef.current) return
      const pos = mapCoords(e.clientX, e.clientY)
      if (!pos) return

      const PIXELS_PER_TICK = 120
      let hscroll = 0
      let vscroll = 0

      if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
        hscroll = -e.deltaX / PIXELS_PER_TICK
        vscroll = -e.deltaY / PIXELS_PER_TICK
      } else if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        hscroll = -e.deltaX / 3
        vscroll = -e.deltaY / 3
      } else {
        hscroll = -Math.sign(e.deltaX)
        vscroll = -Math.sign(e.deltaY)
      }

      hscroll = Math.max(-1, Math.min(1, hscroll))
      vscroll = Math.max(-1, Math.min(1, vscroll))

      let buttons = 0
      if (e.buttons & 1) buttons |= 1
      if (e.buttons & 2) buttons |= 2
      if (e.buttons & 4) buttons |= 4

      sendScrollRef.current({
        ...pos,
        width: deviceWidth,
        height: deviceHeight,
        hscroll,
        vscroll,
        buttons,
      })
    }

    // Block touchmove default to prevent scroll/pull-to-refresh
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      canvas.style.touchAction = ''
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
  }, [canvas, enabled, mapCoords, deviceWidth, deviceHeight])
}
