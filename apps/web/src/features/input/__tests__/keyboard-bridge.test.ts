import { describe, expect, it, vi } from 'vitest'
import { createKeyboardHandlers } from '../useKeyboardBridge'

describe('keyboard bridge', () => {
  it('maps Enter and alpha keys to down/up payload', () => {
    const send = vi.fn()
    const handlers = createKeyboardHandlers(send)

    handlers.onKeyDown({ key: 'Enter', repeat: false })
    handlers.onKeyUp({ key: 'Enter' })
    handlers.onKeyDown({ key: 'a', repeat: false })
    handlers.onKeyUp({ key: 'a' })

    expect(send).toHaveBeenNthCalledWith(1, { code: 'ENTER', action: 'down' })
    expect(send).toHaveBeenNthCalledWith(2, { code: 'ENTER', action: 'up' })
    expect(send).toHaveBeenNthCalledWith(3, { code: 'KEY_A', action: 'down' })
    expect(send).toHaveBeenNthCalledWith(4, { code: 'KEY_A', action: 'up' })
  })

  it('ignores unsupported and repeat keys', () => {
    const send = vi.fn()
    const handlers = createKeyboardHandlers(send)

    handlers.onKeyDown({ key: 'Unidentified', repeat: false })
    handlers.onKeyDown({ key: 'a', repeat: true })

    expect(send).not.toHaveBeenCalled()
  })
})
