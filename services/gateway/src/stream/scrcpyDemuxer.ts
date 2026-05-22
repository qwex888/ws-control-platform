import { EventEmitter } from 'node:events'

export type VideoPacket = {
  data: Buffer
  isConfig: boolean
  isKeyFrame: boolean
  pts: bigint
}

export type SessionInfo = {
  width: number
  height: number
}

/**
 * Parses a scrcpy 4.0 video stream (latest protocol).
 *
 * Expected server options: send_frame_meta=true,
 * send_device_meta=false, send_dummy_byte=false.
 * send_stream_meta defaults to true.
 *
 * Stream layout:
 *   codec_id (4 bytes, u32 BE, e.g. 0x68323634 = "h264")
 *   session_meta (12 bytes, sent at start and on rotation):
 *     flags_high (u32 BE, bit 31 set = session marker)
 *     width      (u32 BE)
 *     height     (u32 BE)
 *   repeated packets:
 *     pts_and_flags  (8 bytes, BigUInt64 BE)
 *       - bit 62: config flag (1 = codec config packet like SPS/PPS)
 *       - bit 61: keyframe flag
 *       - bits 0-60: PTS in microseconds
 *     packet_size    (4 bytes, u32 BE)
 *     packet_data    (packet_size bytes, raw H.264 NALUs)
 *
 * The session_meta shares the same 12-byte slot as frame headers but
 * is distinguished by bit 63 of the 8-byte read being set. When read
 * as BigUInt64BE, session packets look like 0x80000000_WWWWWWWW where
 * W is the width. The next u32 is the height. No payload follows.
 *
 * Events:
 *   'codec'   (codecId: number)           — emitted once after reading codec_id
 *   'session' (info: SessionInfo)         — on session meta (start / rotation)
 *   'packet'  (packet: VideoPacket)       — for each media/config packet
 */
export class ScrcpyDemuxer extends EventEmitter {
  private buf = Buffer.alloc(0)
  private state: 'codec_id' | 'header' | 'payload' = 'codec_id'
  private pendingSize = 0
  private pendingConfig = false
  private pendingKeyFrame = false
  private pendingPts = 0n

  // scrcpy 4.0 (latest master) flag positions
  private static FLAG_SESSION = 1n << 63n
  private static FLAG_CONFIG = 1n << 62n
  private static FLAG_KEYFRAME = 1n << 61n
  private static PTS_MASK = (1n << 61n) - 1n

  feed(chunk: Buffer<ArrayBuffer>) {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]) as Buffer<ArrayBuffer>
    this.drain()
  }

  private drain() {
    for (;;) {
      if (this.state === 'codec_id') {
        if (this.buf.length < 4) return
        const codecId = this.buf.readUInt32BE(0)
        this.buf = this.buf.subarray(4)
        this.state = 'header'
        this.emit('codec', codecId)
        continue
      }

      if (this.state === 'header') {
        if (this.buf.length < 12) return
        const ptsAndFlags = this.buf.readBigUInt64BE(0)

        if ((ptsAndFlags & ScrcpyDemuxer.FLAG_SESSION) !== 0n) {
          // Session meta: [flags_high:u32][width:u32][height:u32]
          // Read as BigUInt64 → lower 32 bits = width; next u32 = height
          const width = Number(ptsAndFlags & 0xFFFFFFFFn)
          const height = this.buf.readUInt32BE(8)
          this.buf = this.buf.subarray(12)
          this.emit('session', { width, height } satisfies SessionInfo)
          // No payload — stay in 'header' state
          continue
        }

        this.pendingSize = this.buf.readUInt32BE(8)
        this.pendingConfig = (ptsAndFlags & ScrcpyDemuxer.FLAG_CONFIG) !== 0n
        this.pendingKeyFrame = (ptsAndFlags & ScrcpyDemuxer.FLAG_KEYFRAME) !== 0n
        this.pendingPts = ptsAndFlags & ScrcpyDemuxer.PTS_MASK

        this.buf = this.buf.subarray(12)
        this.state = 'payload'
        continue
      }

      if (this.state === 'payload') {
        if (this.buf.length < this.pendingSize) return
        const data = Buffer.from(this.buf.subarray(0, this.pendingSize))
        this.buf = this.buf.subarray(this.pendingSize)
        this.state = 'header'
        this.emit('packet', {
          data,
          isConfig: this.pendingConfig,
          isKeyFrame: this.pendingKeyFrame,
          pts: this.pendingPts,
        } satisfies VideoPacket)
        continue
      }
    }
  }

  reset() {
    this.buf = Buffer.alloc(0)
    this.state = 'codec_id'
    this.pendingSize = 0
    this.pendingConfig = false
    this.pendingKeyFrame = false
    this.pendingPts = 0n
    this.removeAllListeners()
  }
}
