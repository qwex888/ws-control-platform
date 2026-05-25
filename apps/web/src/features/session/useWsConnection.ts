import { useEffect, useRef, useCallback } from 'react'
import type { WsMessage } from '@wsctl/core'
import { createWsClient, type WsClient } from './wsClient'
import { loadSessionState, updateSessionState } from './sessionStore'
import { useConnectionStore } from '../../store/connectionStore'

type UseWsConnectionOptions = {
  onMessage?: (msg: WsMessage) => void
  onBinary?: (data: ArrayBuffer) => void
  onAuthFailure?: () => void
}

export function useWsConnection(options: UseWsConnectionOptions = {}) {
  const clientRef = useRef<WsClient | null>(null)
  const setStatus = useConnectionStore((s) => s.setStatus)

  const onMessageRef = useRef(options.onMessage)
  onMessageRef.current = options.onMessage

  const onBinaryRef = useRef(options.onBinary)
  onBinaryRef.current = options.onBinary

  const onAuthFailureRef = useRef(options.onAuthFailure)
  onAuthFailureRef.current = options.onAuthFailure

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const client = createWsClient({
      url: wsUrl,
      onMessage: (msg) => {
        if (msg.event === 'session/new') {
          const data = msg.data as { sessionId: string; resumeToken: string }
          updateSessionState({
            lastSessionId: data.sessionId,
            lastResumeToken: data.resumeToken,
          })
        }
        onMessageRef.current?.(msg)
      },
      onBinary: (data) => {
        onBinaryRef.current?.(data)
      },
      onStatusChange: (status) => {
        setStatus(status)

        if (status === 'connected') {
          const session = loadSessionState()
          if (session.lastResumeToken) {
            client.send({
              event: 'session/resume',
              data: { resumeToken: session.lastResumeToken },
            })
          }
        }
      },
      onAuthFailure: () => {
        onAuthFailureRef.current?.()
      },
    })

    clientRef.current = client

    return () => {
      client.close()
      clientRef.current = null
    }
  }, [setStatus])

  const send = useCallback((msg: WsMessage) => {
    clientRef.current?.send(msg)
  }, [])

  const sendBinary = useCallback((data: ArrayBuffer) => {
    clientRef.current?.sendBinary(data)
  }, [])

  return { send, sendBinary }
}
