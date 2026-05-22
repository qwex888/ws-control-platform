import { describe, expect, it } from 'vitest'
import { createBridge } from '../ws/bridge'

describe('resume flow', () => {
  it('restores session by resume token within ttl', () => {
    const bridge = createBridge(1000)
    bridge.issueResumeToken('r1', 's1', 'admin', 100)

    const resumed = bridge.tryResume({ token: 'r1', now: 500 })
    expect(resumed).toEqual({ resumed: true, sessionId: 's1', userId: 'admin' })
  })

  it('expires resume token after ttl', () => {
    const bridge = createBridge(1000)
    bridge.issueResumeToken('r2', 's2', 'admin', 100)

    const resumed = bridge.tryResume({ token: 'r2', now: 1200 })
    expect(resumed).toEqual({ resumed: false, reason: 'NOT_FOUND_OR_EXPIRED' })
  })

  it('extends ttl on heartbeat', () => {
    const bridge = createBridge(1000)
    bridge.issueResumeToken('r3', 's3', 'admin', 100)

    bridge.keepAlive('r3', 900)
    const resumed = bridge.tryResume({ token: 'r3', now: 1700 })
    expect(resumed).toEqual({ resumed: true, sessionId: 's3', userId: 'admin' })
  })
})
