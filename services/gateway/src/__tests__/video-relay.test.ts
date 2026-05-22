import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Duplex, PassThrough } from 'node:stream'
import { VideoRelay } from '../stream/videoRelay'

const PKT_SESSION = 0x00
const PKT_CONFIG = 0x01
const PKT_KEYFRAME = 0x02
const PKT_DELTA = 0x03

function buildCodecId(): Buffer {
  const buf = Buffer.allocUnsafe(4)
  buf.writeUInt32BE(0x68323634, 0)
  return buf
}

/**
 * Build a scrcpy 4.0 session meta: [flags_high:4B][width:4B][height:4B]
 */
function buildSessionMeta(width: number, height: number): Buffer {
  const buf = Buffer.allocUnsafe(12)
  buf.writeUInt32BE(0x80000000, 0)
  buf.writeUInt32BE(width, 4)
  buf.writeUInt32BE(height, 8)
  return buf
}

/**
 * Build a scrcpy 4.0 frame packet (latest protocol):
 *   bit 62 = config, bit 61 = keyframe
 */
function buildPacket(
  payload: Buffer,
  opts: { config?: boolean; keyFrame?: boolean; pts?: bigint } = {},
): Buffer {
  const header = Buffer.allocUnsafe(12)
  let flags = opts.pts ?? 0n
  if (opts.config) flags |= 1n << 62n
  if (opts.keyFrame) flags |= 1n << 61n
  header.writeBigUInt64BE(flags, 0)
  header.writeUInt32BE(payload.length, 8)
  return Buffer.concat([header, payload])
}

function createMockWs(): { ws: any; sent: Buffer[] } {
  const sent: Buffer[] = []
  const ws = {
    readyState: 1, // OPEN
    OPEN: 1,
    send: vi.fn((data: Buffer, _opts?: any) => sent.push(Buffer.from(data))),
  }
  return { ws, sent }
}

describe('VideoRelay', () => {
  let relay: VideoRelay
  let videoStream: PassThrough
  let mockWs: ReturnType<typeof createMockWs>

  beforeEach(() => {
    relay = new VideoRelay()
    videoStream = new PassThrough()
    mockWs = createMockWs()
  })

  it('sends session info from session meta packet', () => {
    relay.attach(videoStream as unknown as Duplex, mockWs.ws)

    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(460, 1080),
    ])
    videoStream.write(stream)

    const sessionMsgs = mockWs.sent.filter(b => b[0] === PKT_SESSION)
    expect(sessionMsgs).toHaveLength(1)
    expect(sessionMsgs[0]!.readUInt32BE(1)).toBe(460)
    expect(sessionMsgs[0]!.readUInt32BE(5)).toBe(1080)
    expect(relay.getSessionSize()).toEqual({ width: 460, height: 1080 })
  })

  it('forwards config, keyframe, and delta packets with correct type bytes', () => {
    relay.attach(videoStream as unknown as Duplex, mockWs.ws)

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1e])
    const keyframe = Buffer.from([0, 0, 0, 1, 0x65, 0xaa])
    const delta = Buffer.from([0, 0, 0, 1, 0x41, 0xbb])

    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(640, 480),
      buildPacket(sps, { config: true }),
      buildPacket(keyframe, { keyFrame: true }),
      buildPacket(delta),
    ])
    videoStream.write(stream)

    const videoPackets = mockWs.sent.filter(b =>
      b[0] === PKT_CONFIG || b[0] === PKT_KEYFRAME || b[0] === PKT_DELTA
    )
    expect(videoPackets.length).toBe(3)

    expect(videoPackets[0]![0]).toBe(PKT_CONFIG)
    expect(videoPackets[0]!.subarray(1)).toEqual(sps)

    expect(videoPackets[1]![0]).toBe(PKT_KEYFRAME)
    expect(videoPackets[1]!.subarray(1)).toEqual(keyframe)

    expect(videoPackets[2]![0]).toBe(PKT_DELTA)
    expect(videoPackets[2]!.subarray(1)).toEqual(delta)
  })

  it('stops forwarding after detach', () => {
    relay.attach(videoStream as unknown as Duplex, mockWs.ws)

    videoStream.write(Buffer.concat([
      buildCodecId(),
      buildSessionMeta(640, 480),
      buildPacket(Buffer.from([0xaa]), { config: true }),
    ]))
    const sentBefore = mockWs.sent.length

    relay.detach()
    expect(relay.isActive()).toBe(false)

    videoStream.write(buildPacket(Buffer.from([1, 2, 3])))
    expect(mockWs.sent.length).toBe(sentBefore)
  })

  it('drops packets when ws is not OPEN', () => {
    relay.attach(videoStream as unknown as Duplex, mockWs.ws)

    videoStream.write(Buffer.concat([
      buildCodecId(),
      buildSessionMeta(640, 480),
      buildPacket(Buffer.from([0xaa]), { config: true }),
    ]))
    mockWs.sent.length = 0

    mockWs.ws.readyState = 3 // CLOSED
    videoStream.write(buildPacket(Buffer.from([0xbb]), { keyFrame: true }))

    expect(mockWs.sent).toHaveLength(0)
  })

  it('handles stream end gracefully', async () => {
    relay.attach(videoStream as unknown as Duplex, mockWs.ws)
    expect(relay.isActive()).toBe(true)

    videoStream.end()
    await new Promise((r) => setTimeout(r, 10))

    expect(relay.isActive()).toBe(false)
  })

  it('updates session on rotation (multiple session metas)', () => {
    relay.attach(videoStream as unknown as Duplex, mockWs.ws)

    videoStream.write(Buffer.concat([
      buildCodecId(),
      buildSessionMeta(460, 1080),
      buildPacket(Buffer.from([0xaa]), { config: true }),
    ]))

    expect(relay.getSessionSize()).toEqual({ width: 460, height: 1080 })

    // simulate rotation
    videoStream.write(Buffer.concat([
      buildSessionMeta(1080, 460),
      buildPacket(Buffer.from([0xbb]), { config: true }),
    ]))

    expect(relay.getSessionSize()).toEqual({ width: 1080, height: 460 })

    const sessionMsgs = mockWs.sent.filter(b => b[0] === PKT_SESSION)
    expect(sessionMsgs).toHaveLength(2)
  })
})
