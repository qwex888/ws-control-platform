export type PersistedSessionState = {
  clientInstanceId: string
  lastSessionId: string | null
  lastResumeToken: string | null
  selectedDeviceKey: string | null
}

const STORAGE_KEY = 'wsctl.session'

const createClientInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `client-${Date.now()}`
}

export const loadSessionState = (): PersistedSessionState => {
  const fallback: PersistedSessionState = {
    clientInstanceId: createClientInstanceId(),
    lastSessionId: null,
    lastResumeToken: null,
    selectedDeviceKey: null,
  }

  const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
  if (!raw) {
    saveSessionState(fallback)
    return fallback
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSessionState>
    return {
      clientInstanceId: parsed.clientInstanceId ?? fallback.clientInstanceId,
      lastSessionId: parsed.lastSessionId ?? null,
      lastResumeToken: parsed.lastResumeToken ?? null,
      selectedDeviceKey: parsed.selectedDeviceKey ?? null,
    }
  } catch {
    saveSessionState(fallback)
    return fallback
  }
}

export const saveSessionState = (state: PersistedSessionState): void => {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const updateSessionState = (
  patch: Partial<Omit<PersistedSessionState, 'clientInstanceId'>>,
): PersistedSessionState => {
  const current = loadSessionState()
  const next: PersistedSessionState = {
    ...current,
    ...patch,
  }
  saveSessionState(next)
  return next
}
