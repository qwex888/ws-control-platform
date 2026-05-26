import type { Duplex } from 'node:stream'
import net from 'node:net'
import { execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { getAdbClient } from './client'

const sleep = promisify(setTimeout)
import { DEFAULT_DEVICE_CONFIG } from '@wsctl/core'

/**
 * ADB forward 绑定的主机地址。
 * 当 ADB_MODE=host 时，adb server 运行在宿主机上，
 * forward 端口监听在宿主机而非容器内。
 */
const ADB_FORWARD_HOST = process.env.ADB_HOST || '127.0.0.1'

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

export async function cleanupStaleScrcpy(serial: string): Promise<void> {
  const adbHost = process.env.ADB_HOST ? `-H ${process.env.ADB_HOST}` : ''

  try {
    execSync(`adb ${adbHost} -s ${serial} shell pkill -f scrcpy`, { stdio: 'ignore', timeout: 5000 })
  } catch {
    // no stale process
  }

  try {
    const list = execSync(`adb ${adbHost} forward --list`, { encoding: 'utf-8', timeout: 5000 })
    for (const line of list.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith(serial)) continue
      const match = trimmed.match(/tcp:(\d+)/)
      if (match) {
        removeForward(serial, Number(match[1]))
      }
    }
  } catch {
    // best-effort
  }

  await sleep(500)
}

export async function startScrcpyServerWithRetry(
  serial: string,
  options: ScrcpyOptions = {},
  maxAttempts = 2,
): Promise<ScrcpyConnection> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[scrcpy] retry attempt ${attempt}/${maxAttempts} for ${serial}`)
        await cleanupStaleScrcpy(serial)
      }
      return await startScrcpyServer(serial, options)
    } catch (err) {
      lastError = err
      console.warn(`[scrcpy] start attempt ${attempt} failed:`, err)
      if (attempt < maxAttempts) {
        await cleanupStaleScrcpy(serial)
      }
    }
  }

  throw lastError
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

  const socketName = `localabstract:scrcpy_${scidHex}`

  const localPort = await setupForward(serial, socketName)
  console.log(`[scrcpy] forward tcp:${localPort} → ${socketName}`)

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
      const socket = net.connect({ port, host: ADB_FORWARD_HOST })
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

/**
 * 设置 ADB forward 并返回分配的本地端口。
 *
 * 当 ADB server 在远程主机上时（ADB_MODE=host），使用 `tcp:0`
 * 让 ADB server 自动分配端口，然后从 forward 列表中解析实际端口。
 * 本地模式下依然使用 findFreePort 明确指定端口号。
 */
async function setupForward(serial: string, socketName: string): Promise<number> {
  const client = getAdbClient()
  const isRemoteAdb = ADB_FORWARD_HOST !== '127.0.0.1' && ADB_FORWARD_HOST !== 'localhost'

  if (isRemoteAdb) {
    await client.forward(serial, 'tcp:0', socketName)
    const port = await resolveForwardedPort(serial, socketName)
    if (!port) throw new Error(`[scrcpy] failed to resolve forwarded port for ${socketName}`)
    return port
  }

  const port = await findFreePort()
  await client.forward(serial, `tcp:${port}`, socketName)
  return port
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

/**
 * 从 `adb forward --list` 中解析指定 socket 对应的本地端口。
 */
function resolveForwardedPort(serial: string, socketName: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const adbHost = process.env.ADB_HOST ? `-H ${process.env.ADB_HOST}` : ''
      const list = execSync(`adb ${adbHost} forward --list`, { encoding: 'utf-8', timeout: 5000 })
      for (const line of list.split('\n')) {
        if (line.includes(serial) && line.includes(socketName)) {
          const match = line.match(/tcp:(\d+)/)
          if (match) {
            resolve(Number(match[1]))
            return
          }
        }
      }
      resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function removeForward(serial: string, port: number) {
  try {
    const adbHost = process.env.ADB_HOST ? `-H ${process.env.ADB_HOST}` : ''
    execSync(`adb ${adbHost} -s ${serial} forward --remove tcp:${port}`, { stdio: 'ignore' })
  } catch {
    // best-effort cleanup
  }
}
