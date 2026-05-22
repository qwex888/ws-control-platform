export type FrameCallback = (frame: VideoFrame) => void
export type SessionCallback = (width: number, height: number) => void

/**
 * Binary protocol from the gateway:
 *   byte 0 = type: 0x00=session, 0x01=config, 0x02=keyframe, 0x03=delta
 *   0x00 → bytes 1-4 width(u32 BE), 5-8 height(u32 BE)
 *   0x01-0x03 → bytes 1+ raw H264 data
 */
const PKT_SESSION = 0x00
const PKT_CONFIG = 0x01
const PKT_KEYFRAME = 0x02

export class H264Decoder {
  private decoder: VideoDecoder | null = null
  private onFrame: FrameCallback
  private onSession: SessionCallback | null
  private configured = false
  private frameCount = 0
  private configData: Uint8Array | null = null

  constructor(onFrame: FrameCallback, onSession?: SessionCallback) {
    this.onFrame = onFrame
    this.onSession = onSession ?? null
  }

  start() {
    if (!('VideoDecoder' in globalThis)) {
      console.warn('WebCodecs not supported — video decoding unavailable')
      return
    }

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.onFrame(frame)
      },
      error: (err) => {
        console.error('VideoDecoder error:', err)
      },
    })

    this.decoder.configure({
      codec: 'avc1.640028',
      optimizeForLatency: true,
    })

    this.configured = true
  }

  /**
   * Feed a typed binary message from the WebSocket.
   */
  feed(raw: ArrayBuffer) {
    const view = new DataView(raw)
    if (raw.byteLength < 1) return

    const type = view.getUint8(0)

    if (type === PKT_SESSION) {
      if (raw.byteLength >= 9) {
        const width = view.getUint32(1)
        const height = view.getUint32(5)
        this.onSession?.(width, height)
      }
      return
    }

    const payload = new Uint8Array(raw, 1)

    if (type === PKT_CONFIG) {
      this.configData = payload
      return
    }

    this.decodePayload(payload, type === PKT_KEYFRAME)
  }

  /**
   * Backwards-compatible: feed raw H264 data without the type header.
   */
  decode(data: ArrayBuffer) {
    if (!this.decoder || !this.configured) return
    if (this.decoder.state === 'closed') return

    const u8 = new Uint8Array(data)
    const isKey = this.isKeyFrame(u8)

    try {
      const chunk = new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta',
        timestamp: performance.now() * 1000,
        data,
      })
      this.decoder.decode(chunk)
    } catch {
      // skip malformed
    }
  }

  stop() {
    if (this.decoder && this.decoder.state !== 'closed') {
      this.decoder.close()
    }
    this.decoder = null
    this.configured = false
    this.frameCount = 0
  }

  private decodePayload(data: Uint8Array, isKeyFrame: boolean) {
    if (!this.decoder || !this.configured) return
    if (this.decoder.state === 'closed') return

    let payload: Uint8Array = data

    if (isKeyFrame && this.configData) {
      const merged = new Uint8Array(this.configData.length + data.length)
      merged.set(this.configData)
      merged.set(data, this.configData.length)
      payload = merged
    }

    try {
      const chunk = new EncodedVideoChunk({
        type: isKeyFrame ? 'key' : 'delta',
        timestamp: this.frameCount * 16_666,
        data: payload,
      })
      this.decoder.decode(chunk)
      this.frameCount++
    } catch {
      // skip malformed
    }
  }

  private isKeyFrame(data: Uint8Array): boolean {
    for (let i = 0; i < data.length - 4; i++) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
        const nalType = data[i + 4]! & 0x1f
        if (nalType === 5 || nalType === 7) return true
      }
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
        const nalType = data[i + 3]! & 0x1f
        if (nalType === 5 || nalType === 7) return true
      }
    }
    return false
  }
}
