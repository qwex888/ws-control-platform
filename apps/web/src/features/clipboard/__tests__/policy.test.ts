import { beforeEach, describe, expect, it } from 'vitest'
import {
  resolveClipboardEnabled,
  setGlobalClipboardDefault,
  setSessionClipboardOverride,
} from '../clipboardPolicyStore'

describe('clipboard policy', () => {
  beforeEach(() => {
    setGlobalClipboardDefault(true)
    setSessionClipboardOverride('s1', undefined)
    setSessionClipboardOverride('s2', undefined)
  })

  it('uses global default on when session has no override', () => {
    expect(resolveClipboardEnabled('s1')).toBe(true)
  })

  it('session override off wins over global on', () => {
    setGlobalClipboardDefault(true)
    setSessionClipboardOverride('s2', false)
    expect(resolveClipboardEnabled('s2')).toBe(false)
  })
})
