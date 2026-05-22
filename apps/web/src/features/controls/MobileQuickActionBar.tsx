import { useCallback } from 'react'
import type { WsMessage } from '@wsctl/core'
import { MOBILE_QUICK_ACTIONS } from './mobileActions'

type Props = {
  send: (msg: WsMessage) => void
}

export function MobileQuickActionBar({ send }: Props) {
  const handleAction = useCallback(
    (id: string) => {
      send({ event: 'control/action', data: { action: id } })
    },
    [send]
  )

  return (
    <nav
      aria-label="快捷操作"
      className="relative z-10 flex shrink-0 items-stretch justify-around border-t border-border/50 bg-background/90 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {MOBILE_QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => handleAction(action.id)}
          className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-muted-foreground transition-colors active:bg-secondary active:text-foreground"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/80">
            <action.icon className="h-4 w-4" />
          </div>
          <span className="max-w-full truncate text-[10px] leading-none">{action.label}</span>
        </button>
      ))}
    </nav>
  )
}
