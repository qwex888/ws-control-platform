import {
  Home,
  ArrowLeft,
  LayoutGrid,
  AppWindow,
  Power,
  RotateCw,
  Camera,
  Volume1,
  Volume2,
  Copy,
  ClipboardPaste,
  Languages,
  ALargeSmall,
} from 'lucide-react'

export type MobileActionDef = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const MOBILE_ACTIONS: MobileActionDef[] = [
  { id: 'back', label: 'Back', icon: ArrowLeft },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'recent', label: 'Recent', icon: LayoutGrid },
  { id: 'menu', label: 'Menu', icon: AppWindow },
  { id: 'power', label: 'Power', icon: Power },
  { id: 'rotate', label: 'Rotate', icon: RotateCw },
  { id: 'screenshot', label: '截屏', icon: Camera },
  { id: 'vol-up', label: 'Vol+', icon: Volume2 },
  { id: 'vol-down', label: 'Vol-', icon: Volume1 },
  { id: 'copy', label: '复制', icon: Copy },
  { id: 'paste', label: '粘贴', icon: ClipboardPaste },
  { id: 'ime-switch', label: '切换输入法', icon: Languages },
  { id: 'lang-toggle', label: '切换中英文', icon: ALargeSmall },
]

/** 移动端画布底部常驻快捷操作 */
export const MOBILE_QUICK_ACTIONS: MobileActionDef[] = MOBILE_ACTIONS.filter((action) =>
  (['back', 'home', 'recent', 'lang-toggle'] as const).includes(
    action.id as 'back' | 'home' | 'recent' | 'lang-toggle'
  )
)
