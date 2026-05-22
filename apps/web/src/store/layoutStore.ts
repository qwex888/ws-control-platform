import { create } from 'zustand'

export type MobileView = 'list' | 'canvas'

interface LayoutState {
  isMobile: boolean
  mobileView: MobileView
  setIsMobile: (v: boolean) => void
  setMobileView: (view: MobileView) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isMobile: false,
  mobileView: 'list',
  setIsMobile: (v) => set({ isMobile: v }),
  setMobileView: (view) => set({ mobileView: view }),
}))
