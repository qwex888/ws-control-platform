import { useCallback } from 'react'
import { Delete, CornerDownLeft } from 'lucide-react'
import type { WsMessage } from '@wsctl/core'

type Props = {
  send: (msg: WsMessage) => void
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK'] as const

const ANDROID_KEYCODE_0 = 7

function keycodeFor(key: (typeof DIGIT_KEYS)[number]): number {
  if (key === 'DEL') return 67 // KEYCODE_DEL
  if (key === 'OK') return 66 // KEYCODE_ENTER
  return ANDROID_KEYCODE_0 + Number(key)
}

export function BlindPinPad({ send }: Props) {
  const press = useCallback(
    (key: (typeof DIGIT_KEYS)[number]) => {
      const keycode = keycodeFor(key)
      send({ event: 'control/keycode', data: { keycode, action: 'down' } })
      send({ event: 'control/keycode', data: { keycode, action: 'up' } })
    },
    [send],
  )

  return (
    <div className="grid grid-cols-3 gap-1.5 p-2">
      {DIGIT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className="flex h-11 items-center justify-center rounded-lg bg-secondary text-sm font-medium transition-colors active:bg-primary active:text-primary-foreground"
        >
          {key === 'DEL' ? (
            <Delete className="h-4.5 w-4.5" />
          ) : key === 'OK' ? (
            <CornerDownLeft className="h-4.5 w-4.5" />
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  )
}
