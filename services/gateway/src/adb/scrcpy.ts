import type { Duplex } from 'node:stream'
import net from 'node:net'
import { execSync } from 'node:child_process'
import { getAdbClient } from './client'
import { DEFAULT_DEVICE_CONFIG } from '@wsctl/core'

export type ScrcpyOptions = {
  maxSize?: number
  bitrate?: number
  maxFps?: number
  captureMode?: 'mirror' | 'virtual_display'
  virtualDisplay?: string
  rootServer?: boolean
}

export type ScrcpyConnection = {
  videoStream: Duplex
  controlStream: Duplex
  close: () => void
}

const SCRCPY_VERSION = '4.0'
const DEVICE_SERVER_PATH = '/data/local/tmp/scrcpy-server.jar'

function randomScidHex(): string {
  const num = Math.floor(Math.random() * 0x7FFF_FFFF)
  return num.toString(16).padStart(8, '0')
}

export async function pushScrcpyServer(serial: string, localPath: string): Promise<void> {
  const client = getAdbClient()
  const transfer = await client.push(serial, localPath, DEVICE_SERVER_PATH)
  await new Promise<void>((resolve, reject) => {
    transfer.on('end', resolve)
    transfer.on('error', reject)
  })
}

export async function startScrcpyServer(
  serial: string,
  options: ScrcpyOptions = {},
): Promise<ScrcpyConnection> {
  const client = getAdbClient()

  const maxSize = options.maxSize ?? DEFAULT_DEVICE_CONFIG.maxSize
  const bitrate = options.bitrate ?? DEFAULT_DEVICE_CONFIG.bitrate
  const maxFps = options.maxFps ?? DEFAULT_DEVICE_CONFIG.fps
  const captureMode = options.captureMode ?? 'mirror'
  const virtualDisplay = options.virtualDisplay || ''
  const scidHex = randomScidHex()
  const localPort = await findFreePort()

  const socketName = `localabstract:scrcpy_${scidHex}`

  console.log(`[scrcpy] forward tcp:${localPort} → ${socketName}`)
  await client.forward(serial, `tcp:${localPort}`, socketName)

  const args = [
    `CLASSPATH=${DEVICE_SERVER_PATH}`,
    'app_process',
    '/',
    'com.genymobile.scrcpy.Server',
    SCRCPY_VERSION,
    `scid=${scidHex}`,
    'tunnel_forward=true',
    'audio=false',
    'video=true',
    'control=true',
    'send_device_meta=false',
    'send_dummy_byte=false',
    'send_frame_meta=true',
    'power_on=true',
    `max_size=${maxSize}`,
    `video_bit_rate=${bitrate}`,
    `max_fps=${maxFps}`,
  ]

  if (captureMode === 'virtual_display') {
    const spec = virtualDisplay || `${maxSize}x${maxSize}/240`
    args.push(`new_display=${spec}`)
    console.log(`[scrcpy] virtual display mode: new_display=${spec}`)
  }

  let shellCmd = args.join(' ')
  if (options.rootServer) {
    shellCmd = `su -c '${shellCmd}'`
    console.log(`[scrcpy] root server mode enabled`)
  }

  console.log(`[scrcpy] starting server on ${serial} (scid=0x${scidHex})`)
  const shell = await client.shell(serial, shellCmd)

  let serverError = ''
  shell.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) {
      console.log(`[scrcpy:${serial}] ${text}`)
      if (text.includes('ERROR')) serverError = text
    }
  })

  // scrcpy 4.0 tunnel_forward mode: server listens, client connects.
  // In forward mode with video=true, audio=false, control=true:
  //   socket #1 = video stream
  //   socket #2 = control stream
  // ADB forward accepts TCP connections immediately even before the device
  // socket exists, so we use a stability check to detect premature closes.

  // IMPORTANT: Do NOT attach 'data' handlers here. Adding a 'data' listener
  // puts the stream into flowing mode, and any data emitted before VideoRelay
  // attaches its own listener would be lost, corrupting the demuxer state.
  // Only 'close' and 'error' are safe (they don't trigger flowing mode).

  const videoStream = await connectStable(localPort, 30, 500, 'video')
  console.log(`[scrcpy] video socket connected`)
  videoStream.on('close', () => console.log(`[scrcpy] video socket closed`))
  videoStream.on('error', (err) => console.error(`[scrcpy] video socket error:`, err))

  const controlStream = await connectStable(localPort, 10, 300, 'control')
  console.log(`[scrcpy] control socket connected`)
  controlStream.on('close', () => console.log(`[scrcpy] control socket closed`))
  controlStream.on('error', (err) => console.error(`[scrcpy] control socket error:`, err))

  if (serverError) {
    console.warn(`[scrcpy] server reported errors during startup: ${serverError}`)
  }

  return {
    videoStream: videoStream as Duplex,
    controlStream: controlStream as Duplex,
    close: () => {
      videoStream.destroy()
      controlStream.destroy()
      shell.destroy()
      removeForward(serial, localPort)
    },
  }
}

/**
 * Connect to an ADB-forwarded port with a stability check.
 *
 * ADB forward listens on the local TCP port and accepts connections
 * immediately. It then tries to connect to the device-side abstract
 * socket. If the socket doesn't exist yet (scrcpy server still starting),
 * ADB closes the proxied connection right away.
 *
 * To distinguish real connections from these premature ones, we wait
 * STABILITY_MS after the TCP connect event. If the socket is still
 * alive after that, we consider it a real connection.
 */
function connectStable(
  port: number,
  maxRetries: number,
  delayMs: number,
  label: string,
): Promise<net.Socket> {
  const STABILITY_MS = 300

  return new Promise((resolve, reject) => {
    let attempt = 0

    function tryConnect() {
      attempt++
      const socket = net.connect({ port, host: '127.0.0.1' })
      let settled = false

      const fail = (reason: string) => {
        if (settled) return
        settled = true
        socket.removeAllListeners()
        socket.destroy()
        if (attempt >= maxRetries) {
          reject(new Error(
            `[scrcpy] ${label} socket: failed after ${maxRetries} attempts (port ${port}). Last: ${reason}`
          ))
        } else {
          setTimeout(tryConnect, delayMs)
        }
      }

      socket.once('connect', () => {
        const timer = setTimeout(() => {
          if (settled) return
          settled = true
          socket.removeAllListeners('close')
          socket.removeAllListeners('end')
          socket.removeAllListeners('error')
          resolve(socket)
        }, STABILITY_MS)

        socket.once('close', () => { clearTimeout(timer); fail('closed immediately') })
        socket.once('end', () => { clearTimeout(timer); fail('ended immediately') })
      })

      socket.once('error', (err) => fail(err.message))
    }

    tryConnect()
  })
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr !== 'string') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        srv.close(() => reject(new Error('Failed to get free port')))
      }
    })
    srv.on('error', reject)
  })
}

function removeForward(serial: string, port: number) {
  try {
    execSync(`adb -s ${serial} forward --remove tcp:${port}`, { stdio: 'ignore' })
  } catch {
    // best-effort cleanup
  }
}
