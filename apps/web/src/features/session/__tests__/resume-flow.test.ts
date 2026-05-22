import { beforeEach, describe, expect, it } from 'vitest'
import { buildResumeMessage } from '../useResumeConnect'
import { saveSessionState } from '../sessionStore'

describe('resume flow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reconnects and restores selected device/session after reload', () => {
    saveSessionState({
      clientInstanceId: 'client-1',
      lastSessionId: 'session-1',
      lastResumeToken: 'resume-token-1',
      selectedDeviceKey: 'SER001::2',
    })

    const msg = buildResumeMessage()

    expect(msg).not.toBeNull()
    expect(msg!.event).toBe('session/resume')
    expect(msg!.data).toEqual({
      clientInstanceId: 'client-1',
      lastSessionId: 'session-1',
      selectedDeviceKey: 'SER001::2',
    })
  })

  it('skips resume when no session metadata', () => {
    saveSessionState({
      clientInstanceId: 'client-1',
      lastSessionId: null,
      lastResumeToken: null,
      selectedDeviceKey: null,
    })

    const msg = buildResumeMessage()
    expect(msg).toBeNull()
  })
})
