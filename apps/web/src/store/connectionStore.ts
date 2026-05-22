import { create } from 'zustand'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface ConnectionState {
  status: ConnectionStatus
  username: string | null
  setStatus: (status: ConnectionStatus) => void
  setUsername: (username: string | null) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  username: null,
  setStatus: (status) => set({ status }),
  setUsername: (username) => set({ username }),
}))
