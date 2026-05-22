import { loadSessionState } from './sessionStore'
import type { WsMessage } from '@wsctl/core'

export function buildResumeMessage(): WsMessage | null {
  const state = loadSessionState()
  if (!state.lastSessionId || !state.selectedDeviceKey) {
    return null
  }

  return {
    event: 'session/resume',
    data: {
      clientInstanceId: state.clientInstanceId,
      lastSessionId: state.lastSessionId,
      selectedDeviceKey: state.selectedDeviceKey,
    },
  }
}
