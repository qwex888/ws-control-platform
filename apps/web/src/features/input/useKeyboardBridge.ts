import { useEffect } from 'react'
import { mapKeyboardKey, type KeyEventPayload } from '@wsctl/core'

export type KeyboardBridgeSender = (payload: KeyEventPayload) => void

export type HidKeyEventPayload = {
  code: string
  action: 'down' | 'up'
  modifiers: {
    ctrl: boolean
    shift: boolean
    alt: boolean
    meta: boolean
  }
}

export type HidKeyboardBridgeSender = (payload: HidKeyEventPayload) => void

export const createKeyboardHandlers = (send: KeyboardBridgeSender) => {
  const onKeyDown = (event: Pick<KeyboardEvent, 'key' | 'repeat'>) => {
    if (event.repeat) return
    const code = mapKeyboardKey(event.key)
    if (!code) return
    send({ code, action: 'down' })
  }

  const onKeyUp = (event: Pick<KeyboardEvent, 'key'>) => {
    const code = mapKeyboardKey(event.key)
    if (!code) return
    send({ code, action: 'up' })
  }

  return { onKeyDown, onKeyUp }
}

const PASSTHROUGH_CODES = new Set([
  'F5', 'F12',
])

function shouldIntercept(event: KeyboardEvent): boolean {
  if (event.isComposing) return false
  if (!event.code) return false

  const target = event.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
    return false
  }

  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
    const key = event.key.toLowerCase()
    if (key === 'r' || key === 'l' || key === 'j' || key === 'u' || key === 'c' || key === 'v') {
      return false
    }
  }

  if (PASSTHROUGH_CODES.has(event.code)) return false

  return true
}

/**
 * UHID keyboard bridge: sends DOM KeyboardEvent.code (physical key)
 * directly, letting the Android native IME handle character composition.
 * Only intercepts keys when the focus is on the canvas/body, not on input fields.
 */
export const useKeyboardBridge = (
  enabled: boolean,
  sendHid: HidKeyboardBridgeSender,
): void => {
  useEffect(() => {
    if (!enabled) return

    const handleDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (!shouldIntercept(event)) return

      event.preventDefault()
      sendHid({
        code: event.code,
        action: 'down',
        modifiers: {
          ctrl: event.ctrlKey || event.metaKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
      })
    }

    const handleUp = (event: KeyboardEvent) => {
      if (!shouldIntercept(event)) return

      event.preventDefault()
      sendHid({
        code: event.code,
        action: 'up',
        modifiers: {
          ctrl: event.ctrlKey || event.metaKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
      })
    }

    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)

    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
    }
  }, [enabled, sendHid])
}
