import { WebSocketServer, WebSocket } from 'ws'
import type { Server as HttpServer, IncomingMessage } from 'node:http'
import { parse as parseCookie } from 'cookie'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyAccessToken } from '../auth/jwt'
import { createBridge } from './bridge'
import { listDevices, getDeviceProperties } from '../adb/client'
import { DeviceTracker, type DeviceEvent } from '../adb/tracker'
import {
  pushScrcpyServer,
  cleanupStaleScrcpy,
  startScrcpyServerWithRetry,
  type ScrcpyConnection,
  type ScrcpyOptions,
} from '../adb/scrcpy'
import {
  checkDeviceReady,
  waitForAuthorization,
  recoverOfflineDevice,
  getSuggestion,
  type DeviceNotReadyReason,
} from '../adb/healthCheck'
import { VideoRelay } from '../stream/videoRelay'
import { ControlRelay, type TouchEvent, type ScrollEvent, type ControlAction } from '../stream/controlRelay'
import { UhidKeyboard, DOM_CODE_TO_HID } from '../stream/uhidKeyboard'
import { DeviceConfigRepo } from '../device/repo'
import { DEFAULT_DEVICE_CONFIG } from '@wsctl/core'

export type ClientSession = {
  userId: string
  sessionId: string
  resumeToken: string
  connectedDevice: string | null
  ws: WebSocket
  alive: boolean
  scrcpy: ScrcpyConnection | null
  videoRelay: VideoRelay
  controlRelay: ControlRelay
  uhidKeyboard: UhidKeyboard
}

const HEARTBEAT_INTERVAL_MS = 30_000
const RESUME_TTL_MS = 120_000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLED_SCRCPY_SERVER = path.resolve(__dirname, '../../vendor/scrcpy-server.jar')
const SCRCPY_SERVER_PATH = process.env.SCRCPY_SERVER_PATH || BUNDLED_SCRCPY_SERVER

export type WsContext = {
  wss: InstanceType<typeof WebSocketServer>
  sessions: Map<string, ClientSession>
  refreshDeviceList: () => void
}

export function attachWebSocket(httpServer: HttpServer, deviceConfigRepo?: DeviceConfigRepo): WsContext {
  const bridge = createBridge(RESUME_TTL_MS)
  const sessions = new Map<string, ClientSession>()

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  const tracker = new DeviceTracker()
  tracker.start().catch((err) => {
    console.error('[ws] DeviceTracker start failed:', err)
  })

  tracker.on('device', (evt: DeviceEvent) => {
    broadcastDeviceList(sessions, tracker)
  })

  const heartbeatTimer = setInterval(() => {
    for (const [, session] of sessions) {
      if (!session.alive) {
        session.ws.terminate()
        continue
      }
      session.alive = false
      sendJson(session.ws, { event: 'heartbeat/ping' })
    }
  }, HEARTBEAT_INTERVAL_MS)

  wss.on('close', () => {
    clearInterval(heartbeatTimer)
    tracker.stop()
  })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const userId = authenticateFromCookie(req)
    if (!userId) {
      ws.close(4001, 'UNAUTHORIZED')
      return
    }

    const sessionId = randomBytes(16).toString('hex')
    const resumeToken = randomBytes(16).toString('hex')

    bridge.issueResumeToken(resumeToken, sessionId, userId, Date.now())

    const session: ClientSession = {
      userId,
      sessionId,
      resumeToken,
      connectedDevice: null,
      ws,
      alive: true,
      scrcpy: null,
      videoRelay: new VideoRelay(),
      controlRelay: new ControlRelay(),
      uhidKeyboard: new UhidKeyboard(),
    }
    sessions.set(sessionId, session)

    console.log(`[ws] client connected: userId=${userId}, sessionId=${sessionId}`)

    sendJson(ws, {
      event: 'session/new',
      data: { sessionId, resumeToken },
    })

    ws.on('message', (raw, isBinary) => {
      session.alive = true

      if (isBinary) return

      const text = typeof raw === 'string' ? raw : raw.toString('utf-8')

      let msg: { event: string; data?: Record<string, unknown>; requestId?: string }
      try {
        msg = JSON.parse(text)
      } catch {
        return
      }

      console.log(`[ws] ← ${msg.event}`, msg.data ? JSON.stringify(msg.data).slice(0, 120) : '')

      handleMessage(session, msg, bridge, tracker, deviceConfigRepo).catch((err) => {
        console.error(`[ws] handleMessage error (${msg.event}):`, err)
        sendJson(ws, { event: 'error', data: { code: 'INTERNAL', reason: String(err) } })
      })
    })

    ws.on('close', () => {
      console.log(`[ws] client disconnected: sessionId=${sessionId}`)
      cleanupSession(session)
      sessions.delete(sessionId)
    })

    ws.on('error', () => {
      cleanupSession(session)
      sessions.delete(sessionId)
    })
  })

  const refreshDeviceList = () => broadcastDeviceList(sessions, tracker)

  return { wss, sessions, refreshDeviceList }
}

function authenticateFromCookie(req: IncomingMessage): string | null {
  if (process.env.NODE_ENV !== 'production') {
    return 'dev'
  }

  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  const cookies = parseCookie(cookieHeader)
  const token = cookies.access_token
  if (!token) return null

  try {
    const payload = verifyAccessToken(token)
    return payload.sub
  } catch {
    return null
  }
}

async function handleMessage(
  session: ClientSession,
  msg: { event: string; data?: Record<string, unknown>; requestId?: string },
  bridge: ReturnType<typeof createBridge>,
  tracker: DeviceTracker,
  deviceConfigRepo?: DeviceConfigRepo,
) {
  const { ws } = session

  switch (msg.event) {
    case 'heartbeat/pong':
      session.alive = true
      bridge.keepAlive(session.resumeToken, Date.now())
      break

    case 'session/resume': {
      const token = msg.data?.resumeToken as string | undefined
      if (!token) break
      const result = bridge.tryResume({ token, now: Date.now() })
      if (result.resumed) {
        session.sessionId = result.sessionId
        session.userId = result.userId
        sendJson(ws, { event: 'session/resumed', data: { sessionId: result.sessionId } })
      } else {
        sendJson(ws, { event: 'error', data: { code: 'RESUME_FAILED', reason: result.reason } })
      }
      break
    }

    case 'device/list': {
      const devices = await buildDeviceList(tracker)
      console.log(`[ws] → device/list: ${devices.length} device(s)`, devices.map((d) => d.id))
      sendJson(ws, { event: 'device/list', data: { devices }, requestId: msg.requestId })
      break
    }

    case 'device/connect': {
      const serial = msg.data?.serial as string | undefined
      if (!serial) {
        sendJson(ws, { event: 'error', data: { code: 'MISSING_SERIAL' } })
        break
      }

      if (session.scrcpy) {
        cleanupScrcpy(session)
      }

      const requestId = msg.requestId
      const sendConnect = (status: string, extra?: Record<string, unknown>) => {
        sendJson(ws, {
          event: 'device/connect',
          data: { status, serial, ...extra },
          requestId,
        })
      }

      const failConnect = (reason: string, suggestion?: string) => {
        cleanupScrcpy(session)
        session.connectedDevice = null
        sendConnect('failed', { reason, suggestion })
      }

      try {
        sendConnect('checking')

        let readiness = await checkDeviceReady(serial)

        while (!readiness.ready) {
          if (readiness.reason === 'unauthorized') {
            sendConnect('waiting_auth', {
              suggestion: getSuggestion('unauthorized'),
            })
            const authorized = await waitForAuthorization(serial, 30_000)
            if (!authorized) {
              failConnect('设备未授权', getSuggestion('unauthorized'))
              break
            }
            readiness = await checkDeviceReady(serial)
            continue
          }

          if (readiness.reason === 'offline') {
            sendConnect('recovering', {
              suggestion: getSuggestion('offline'),
            })
            const recovered = await recoverOfflineDevice(serial)
            if (!recovered) {
              failConnect('设备离线', getSuggestion('offline'))
              break
            }
            readiness = await checkDeviceReady(serial)
            continue
          }

          const reason = readiness.reason
          failConnect(
            humanizeNotReadyReason(reason),
            getSuggestion(reason),
          )
          break
        }

        if (!readiness.ready) break

        sendConnect('cleaning')
        await cleanupStaleScrcpy(serial)

        const savedConfig = deviceConfigRepo?.getBySerial(session.userId, serial)?.config
        const msgConfig = msg.data?.config as Record<string, unknown> | undefined

        const scrcpyOptions: ScrcpyOptions = {
          maxSize: (msgConfig?.maxSize as number) ?? savedConfig?.maxSize ?? DEFAULT_DEVICE_CONFIG.maxSize,
          bitrate: (msgConfig?.bitrate as number) ?? savedConfig?.bitrate ?? DEFAULT_DEVICE_CONFIG.bitrate,
          maxFps: (msgConfig?.fps as number) ?? savedConfig?.fps ?? DEFAULT_DEVICE_CONFIG.fps,
          captureMode: (msgConfig?.captureMode as 'mirror' | 'virtual_display') ?? savedConfig?.captureMode ?? DEFAULT_DEVICE_CONFIG.captureMode,
          virtualDisplay: (msgConfig?.virtualDisplay as string) ?? savedConfig?.virtualDisplay ?? DEFAULT_DEVICE_CONFIG.virtualDisplay,
          rootServer:
            ((msgConfig?.secureCaptureMode as string) ?? savedConfig?.secureCaptureMode ?? DEFAULT_DEVICE_CONFIG.secureCaptureMode) === 'root_server',
        }

        sendConnect('pushing')
        console.log(`[ws] pushing scrcpy-server to ${serial} ...`)
        await pushScrcpyServer(serial, SCRCPY_SERVER_PATH)

        sendConnect('starting')
        sendConnect('connecting')

        const conn = await startScrcpyServerWithRetry(serial, scrcpyOptions)
        session.scrcpy = conn
        session.connectedDevice = serial

        const notifyStreamLost = (stream: 'video' | 'control') => {
          if (session.connectedDevice !== serial) return
          sendJson(ws, {
            event: 'device/stream-lost',
            data: { serial, stream },
          })
        }

        session.videoRelay.attach(conn.videoStream, ws, {
          onStreamLost: () => notifyStreamLost('video'),
        })
        session.controlRelay.attach(conn.controlStream)

        conn.controlStream.once('close', () => notifyStreamLost('control'))
        conn.controlStream.once('error', () => notifyStreamLost('control'))

        session.controlRelay.turnScreenOn()
        session.uhidKeyboard.attach(session.controlRelay)
        console.log(`[ws] scrcpy connected to ${serial}`)

        sendConnect('connected')
      } catch (err) {
        console.error('[ws] scrcpy connect pipeline failed:', err)
        failConnect(String(err), parseConnectErrorSuggestion(err))
      }
      break
    }

    case 'device/disconnect':
      cleanupScrcpy(session)
      session.connectedDevice = null
      sendJson(ws, { event: 'device/disconnect', data: { status: 'disconnected' } })
      break

    case 'input/touch': {
      const d = msg.data as TouchEvent | undefined
      if (d) session.controlRelay.injectTouch(d)
      break
    }

    case 'input/scroll': {
      const d = msg.data as ScrollEvent | undefined
      if (d) session.controlRelay.injectScroll(d)
      break
    }

    case 'input/keyboard': {
      const code = msg.data?.code as string | undefined
      const action = msg.data?.action as 'down' | 'up' | undefined
      if (code && action) {
        const keycode = mapKeyToAndroid(code)
        if (keycode != null) {
          session.controlRelay.injectKeycode({ action, keycode })
        }
      }
      break
    }

    case 'input/key-hid': {
      const code = msg.data?.code as string | undefined
      const action = msg.data?.action as 'down' | 'up' | undefined
      const modifiers = msg.data?.modifiers as { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } | undefined
      if (!code || !action) break

      const hidCode = DOM_CODE_TO_HID[code]
      if (hidCode == null) break

      if (action === 'down') {
        session.uhidKeyboard.pressKey(hidCode, modifiers)
      } else {
        session.uhidKeyboard.releaseKey(hidCode, modifiers)
      }
      break
    }

    case 'input/text': {
      const text = msg.data?.text as string | undefined
      if (text) session.controlRelay.sendText(text)
      break
    }

    case 'control/keycode': {
      const keycode = msg.data?.keycode as number | undefined
      const kAction = msg.data?.action as 'down' | 'up' | undefined
      if (keycode != null && kAction) {
        session.controlRelay.injectKeycode({ action: kAction, keycode })
      }
      break
    }

    case 'control/action': {
      const action = msg.data?.action as ControlAction | undefined
      if (action) session.controlRelay.injectAction(action)
      break
    }

    case 'clipboard/sync':
    case 'clipboard/policy':
      break

    default:
      break
  }
}

function cleanupScrcpy(session: ClientSession) {
  session.uhidKeyboard.detach()
  session.videoRelay.detach()
  session.controlRelay.detach()
  if (session.scrcpy) {
    session.scrcpy.close()
    session.scrcpy = null
  }
}

function cleanupSession(session: ClientSession) {
  cleanupScrcpy(session)
}

async function buildDeviceList(tracker: DeviceTracker) {
  let devices: import('../adb/client').AdbDevice[]

  try {
    devices = await listDevices()
  } catch (err) {
    console.warn('[ws] listDevices() failed, falling back to tracker:', err)
    devices = tracker.getDevices()
  }

  console.log(`[ws] buildDeviceList: ${devices.length} device(s)`, devices.map((d) => `${d.id}(${d.type})`))
  return devices.map((d) => ({
    id: d.id,
    type: d.type,
    name: d.id,
  }))
}

function broadcastDeviceList(sessions: Map<string, ClientSession>, tracker: DeviceTracker) {
  buildDeviceList(tracker).then((devices) => {
    const msg = JSON.stringify({ event: 'device/list', data: { devices } })
    for (const [, session] of sessions) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(msg)
      }
    }
  }).catch(() => {})
}

/**
 * Maps frontend key codes to Android keycodes (legacy fallback).
 */
const ANDROID_KEYCODE_MAP: Record<string, number> = {
  ENTER: 66,
  BACKSPACE: 67,
  TAB: 61,
  ESCAPE: 111,
  ARROW_UP: 19,
  ARROW_DOWN: 20,
  ARROW_LEFT: 21,
  ARROW_RIGHT: 22,
  SPACE: 62,
  DELETE: 112,
  HOME: 3,
  END: 123,
  PAGE_UP: 92,
  PAGE_DOWN: 93,
  Enter: 66,
  Backspace: 67,
  Delete: 112,
  Tab: 61,
  Escape: 111,
  ArrowUp: 19,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  Home: 3,
  End: 123,
  PageUp: 92,
  PageDown: 93,
  Space: 62,
}

function mapKeyToAndroid(code: string): number | null {
  if (ANDROID_KEYCODE_MAP[code] !== undefined) return ANDROID_KEYCODE_MAP[code]!

  if (code.startsWith('KEY_') && code.length === 5) {
    const ch = code.charCodeAt(4)
    if (ch >= 65 && ch <= 90) return ch - 65 + 29
  }

  if (code.startsWith('DIGIT_') && code.length === 7) {
    const d = code.charCodeAt(6)
    if (d >= 48 && d <= 57) return d - 48 + 7
  }

  if (code.length === 1) {
    const c = code.charCodeAt(0)
    if (c >= 48 && c <= 57) return c - 48 + 7
    if (c >= 65 && c <= 90) return c - 65 + 29
    if (c >= 97 && c <= 122) return c - 97 + 29
  }

  return null
}

function sendJson(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function humanizeNotReadyReason(reason: DeviceNotReadyReason): string {
  switch (reason) {
    case 'unauthorized':
      return '设备未授权'
    case 'offline':
      return '设备离线'
    case 'no_permissions':
      return '无设备访问权限'
    case 'not_found':
      return '未找到设备'
    default:
      return '设备不可用'
  }
}

function parseConnectErrorSuggestion(err: unknown): string | undefined {
  const msg = String(err)
  if (msg.includes('ECONNREFUSED') || msg.includes('socket: failed')) {
    return '连接投屏服务失败，请稍后重试；若仍失败请重新插拔设备'
  }
  if (msg.toLowerCase().includes('offline')) {
    return getSuggestion('offline')
  }
  if (msg.includes('unauthorized')) {
    return getSuggestion('unauthorized')
  }
  return undefined
}
