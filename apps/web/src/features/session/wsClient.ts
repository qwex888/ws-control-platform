import type { WsMessage } from '@wsctl/core'

export type WsClientOptions = {
  url: string
  onMessage: (msg: WsMessage) => void
  onBinary: (data: ArrayBuffer) => void
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void
  reconnectDelayMs?: number
  maxReconnectDelayMs?: number
}

export type WsClient = {
  send: (msg: WsMessage) => void
  sendBinary: (data: ArrayBuffer) => void
  close: () => void
}

export function createWsClient(options: WsClientOptions): WsClient {
  const {
    url,
    onMessage,
    onBinary,
    onStatusChange,
    reconnectDelayMs = 1000,
    maxReconnectDelayMs = 30000,
  } = options

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let currentDelay = reconnectDelayMs
  let intentionalClose = false

  function connect() {
    onStatusChange('connecting')
    ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      currentDelay = reconnectDelayMs
      onStatusChange('connected')
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        onBinary(event.data)
      } else if (typeof event.data === 'string') {
        let msg: WsMessage
        try {
          msg = JSON.parse(event.data) as WsMessage
        } catch {
          return
        }
        onMessage(msg)
      }
    }

    ws.onclose = () => {
      ws = null
      onStatusChange('disconnected')
      if (!intentionalClose) {
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      currentDelay = Math.min(currentDelay * 1.5, maxReconnectDelayMs)
      connect()
    }, currentDelay)
  }

  function send(msg: WsMessage) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function sendBinary(data: ArrayBuffer) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }

  function close() {
    intentionalClose = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    ws?.close()
    ws = null
  }

  connect()

  return { send, sendBinary, close }
}
