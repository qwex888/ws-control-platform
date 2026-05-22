import type { Duplex } from 'node:stream'
import type { WebSocket } from 'ws'
import { ScrcpyDemuxer, type VideoPacket, type SessionInfo } from './scrcpyDemuxer'

/** Binary message type byte sent to the WS client. */
const PKT_SESSION = 0x00
const PKT_CONFIG = 0x01
const PKT_KEYFRAME = 0x02
const PKT_DELTA = 0x03

export class VideoRelay {
  private demuxer: ScrcpyDemuxer | null = null
  private videoStream: Duplex | null = null
  private ws: WebSocket | null = null
  private active = false

  private sessionWidth = 0
  private sessionHeight = 0
  private bytesReceived = 0
  private packetsSent = 0

  attach(videoStream: Duplex, ws: WebSocket) {
    this.detach()
    this.videoStream = videoStream
    this.ws = ws
    this.active = true
    this.bytesReceived = 0
    this.packetsSent = 0

    this.demuxer = new ScrcpyDemuxer()

    this.demuxer.on('codec', (codecId: number) => {
      const name = Buffer.alloc(4)
      name.writeUInt32BE(codecId, 0)
      console.log(`[video-relay] codec: 0x${codecId.toString(16)} (${name.toString('ascii')})`)
    })

    this.demuxer.on('session', (info: SessionInfo) => {
      if (!this.active || ws.readyState !== ws.OPEN) return
      this.sessionWidth = info.width
      this.sessionHeight = info.height
      console.log(`[video-relay] session: ${info.width}x${info.height}`)
      this.sendSessionInfo(ws, info)
    })

    this.demuxer.on('packet', (pkt: VideoPacket) => {
      if (!this.active || ws.readyState !== ws.OPEN) return

      const type = pkt.isConfig ? PKT_CONFIG : pkt.isKeyFrame ? PKT_KEYFRAME : PKT_DELTA
      const msg = Buffer.allocUnsafe(1 + pkt.data.length)
      msg[0] = type
      pkt.data.copy(msg, 1)
      ws.send(msg, { binary: true })
      this.packetsSent++
      if (this.packetsSent <= 5 || this.packetsSent % 300 === 0) {
        const label = pkt.isConfig ? 'config' : pkt.isKeyFrame ? 'keyframe' : 'delta'
        console.log(`[video-relay] → ws binary #${this.packetsSent} (${label}, ${pkt.data.length}B)`)
      }
    })

    videoStream.on('data', (chunk: Buffer<ArrayBuffer>) => {
      if (this.active) {
        if (this.bytesReceived === 0) {
          const head = [...chunk.subarray(0, Math.min(16, chunk.length))]
            .map(b => b.toString(16).padStart(2, '0')).join(' ')
          console.log(`[video-relay] ← first data: ${chunk.length} bytes [${head}]`)
        }
        this.bytesReceived += chunk.length
        this.demuxer!.feed(chunk)
      }
    })

    videoStream.on('end', () => {
      console.log(`[video-relay] video stream ended (${this.bytesReceived}B received, ${this.packetsSent} packets sent)`)
      this.active = false
    })
    videoStream.on('error', (err) => {
      console.error(`[video-relay] video stream error:`, err)
      this.active = false
    })
  }

  detach() {
    this.active = false
    if (this.demuxer) {
      this.demuxer.reset()
      this.demuxer = null
    }
    if (this.videoStream) {
      this.videoStream.removeAllListeners('data')
      this.videoStream.removeAllListeners('end')
      this.videoStream.removeAllListeners('error')
      this.videoStream = null
    }
    this.ws = null
  }

  isActive() {
    return this.active
  }

  getSessionSize() {
    return { width: this.sessionWidth, height: this.sessionHeight }
  }

  private sendSessionInfo(ws: WebSocket, info: { width: number; height: number }) {
    if (ws.readyState !== ws.OPEN) return
    const buf = Buffer.allocUnsafe(9)
    buf[0] = PKT_SESSION
    buf.writeUInt32BE(info.width, 1)
    buf.writeUInt32BE(info.height, 5)
    ws.send(buf, { binary: true })
  }
}
