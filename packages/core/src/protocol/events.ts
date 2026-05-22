export const WS_EVENTS = {
  AUTH_LOGIN: 'auth/login',
  SESSION_RESUME: 'session/resume',
  SESSION_NEW: 'session/new',
  SESSION_RESUMED: 'session/resumed',
  DEVICE_CONNECT: 'device/connect',
  DEVICE_DISCONNECT: 'device/disconnect',
  DEVICE_LIST: 'device/list',
  DEVICE_CONFIG_UPDATE: 'device/config/update',
  INPUT_KEYBOARD: 'input/keyboard',
  INPUT_KEY_HID: 'input/key-hid',
  INPUT_TEXT: 'input/text',
  INPUT_TOUCH: 'input/touch',
  CONTROL_ACTION: 'control/action',
  CLIPBOARD_SYNC: 'clipboard/sync',
  CLIPBOARD_POLICY: 'clipboard/policy',
  VIDEO_FRAME: 'video/frame',
  HEARTBEAT_PING: 'heartbeat/ping',
  HEARTBEAT_PONG: 'heartbeat/pong',
  ERROR: 'error',
} as const

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS]

export type WsMessage = {
  event: WsEventName
  data?: unknown
  requestId?: string
}
