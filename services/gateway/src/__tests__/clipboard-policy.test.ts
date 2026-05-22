import { describe, expect, it } from 'vitest'
import { resolveClipboardPolicy } from '../ws/clipboard'

describe('gateway clipboard policy', () => {
  it('falls back to global default when no override', () => {
    expect(resolveClipboardPolicy({ globalDefaultEnabled: true })).toBe(true)
    expect(resolveClipboardPolicy({ globalDefaultEnabled: false })).toBe(false)
  })

  it('session override has priority', () => {
    expect(resolveClipboardPolicy({ globalDefaultEnabled: true, sessionOverride: false })).toBe(false)
    expect(resolveClipboardPolicy({ globalDefaultEnabled: false, sessionOverride: true })).toBe(true)
  })
})
