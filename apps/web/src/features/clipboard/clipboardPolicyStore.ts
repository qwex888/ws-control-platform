export type ClipboardPolicyState = {
  globalDefaultEnabled: boolean
  sessionOverride: Record<string, boolean | undefined>
}

const state: ClipboardPolicyState = {
  globalDefaultEnabled: true,
  sessionOverride: {},
}

export const getClipboardPolicyState = (): ClipboardPolicyState => ({
  globalDefaultEnabled: state.globalDefaultEnabled,
  sessionOverride: { ...state.sessionOverride },
})

export const setGlobalClipboardDefault = (enabled: boolean): void => {
  state.globalDefaultEnabled = enabled
}

export const setSessionClipboardOverride = (sessionId: string, enabled?: boolean): void => {
  state.sessionOverride = {
    ...state.sessionOverride,
    [sessionId]: enabled,
  }
}

export const resolveClipboardEnabled = (sessionId: string): boolean => {
  const override = state.sessionOverride[sessionId]
  return override ?? state.globalDefaultEnabled
}
