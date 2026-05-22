import { useState } from 'react'
import { ArrowLeft, MoreHorizontal, Wifi, WifiOff } from 'lucide-react'
import type { WsMessage } from '@wsctl/core'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { MobileActionDrawer } from './MobileActionDrawer'
import type { DeviceStatus } from '../../store/deviceStore'

type Props = {
  deviceName: string
  status: DeviceStatus
  onBack: () => void
  send: (msg: WsMessage) => void
}

export function MobileToolbar({ deviceName, status, onBack, send }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className="relative z-10 flex h-11 shrink-0 items-center justify-between bg-background/80 px-2 backdrop-blur-md border-b border-border/50">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="max-w-[160px] truncate text-sm font-medium">{deviceName}</span>
          <Badge
            variant={status === 'online' ? 'success' : status === 'connecting' ? 'warning' : 'secondary'}
            className="text-[10px] gap-1"
          >
            {status === 'online' ? (
              <Wifi className="h-2.5 w-2.5" />
            ) : (
              <WifiOff className="h-2.5 w-2.5" />
            )}
            {status === 'online' ? '已连接' : status === 'connecting' ? '连接中' : '离线'}
          </Badge>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDrawerOpen(true)}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </header>

      <MobileActionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        send={send}
        onDisconnect={onBack}
      />
    </>
  )
}
