import { describe, expect, it, vi } from 'vitest'
import { ScrcpyDemuxer, type VideoPacket, type SessionInfo } from '../stream/scrcpyDemuxer'

function buildCodecId(id = 0x68323634 /* h264 */): Buffer {
  const buf = Buffer.allocUnsafe(4)
  buf.writeUInt32BE(id, 0)
  return buf
}

/**
 * Build a scrcpy 4.0 session meta packet: [flags_high: 4B] [width: 4B] [height: 4B]
 *
 * In the latest protocol, bit 63 of the 8-byte read = session marker.
 * flags_high has bit 31 set (0x80000000).
 */
function buildSessionMeta(width: number, height: number): Buffer {
  const buf = Buffer.allocUnsafe(12)
  buf.writeUInt32BE(0x80000000, 0) // flags_high with session bit
  buf.writeUInt32BE(width, 4)
  buf.writeUInt32BE(height, 8)
  return buf
}

/**
 * Build a scrcpy 4.0 frame packet: [pts_and_flags: 8B] [size: 4B] [data]
 *
 * pts_and_flags layout (latest protocol):
 *   bit 62 = config flag
 *   bit 61 = keyframe flag
 *   bits 0-60 = PTS in microseconds
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

describe('ScrcpyDemuxer', () => {
  it('parses codec_id and emits codec event', () => {
    const demuxer = new ScrcpyDemuxer()
    const codecSpy = vi.fn()
    demuxer.on('codec', codecSpy)

    demuxer.feed(buildCodecId(0x68323634))
    expect(codecSpy).toHaveBeenCalledWith(0x68323634)
  })

  it('parses session meta and emits session event', () => {
    const demuxer = new ScrcpyDemuxer()
    const sessions: SessionInfo[] = []
    demuxer.on('session', (s: SessionInfo) => sessions.push(s))

    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(460, 1080),
    ])

    demuxer.feed(stream)

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toEqual({ width: 460, height: 1080 })
  })

  it('parses session meta followed by config and keyframe', () => {
    const demuxer = new ScrcpyDemuxer()
    const sessions: SessionInfo[] = []
    const packets: VideoPacket[] = []
    demuxer.on('session', (s: SessionInfo) => sessions.push(s))
    demuxer.on('packet', (p: VideoPacket) => packets.push(p))

    const spsData = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1e])
    const idrData = Buffer.from([0, 0, 0, 1, 0x65, 0xab, 0xcd])

    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(1920, 1080),
      buildPacket(spsData, { config: true }),
      buildPacket(idrData, { keyFrame: true, pts: 1000n }),
    ])

    demuxer.feed(stream)

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toEqual({ width: 1920, height: 1080 })

    expect(packets).toHaveLength(2)
    expect(packets[0]!.isConfig).toBe(true)
    expect(packets[0]!.isKeyFrame).toBe(false)
    expect(Buffer.compare(packets[0]!.data, spsData)).toBe(0)

    expect(packets[1]!.isKeyFrame).toBe(true)
    expect(packets[1]!.isConfig).toBe(false)
    expect(packets[1]!.pts).toBe(1000n)
  })

  it('handles data arriving byte-by-byte', () => {
    const demuxer = new ScrcpyDemuxer()
    const sessions: SessionInfo[] = []
    const packets: VideoPacket[] = []
    demuxer.on('session', (s: SessionInfo) => sessions.push(s))
    demuxer.on('packet', (p: VideoPacket) => packets.push(p))

    const payload = Buffer.from([0, 0, 0, 1, 0x65, 0xab, 0xcd])
    const full = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(460, 1080),
      buildPacket(payload, { keyFrame: true }),
    ])

    for (let i = 0; i < full.length; i++) {
      demuxer.feed(Buffer.from([full[i]!]))
    }

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toEqual({ width: 460, height: 1080 })
    expect(packets).toHaveLength(1)
    expect(packets[0]!.isKeyFrame).toBe(true)
    expect(packets[0]!.data.length).toBe(payload.length)
  })

  it('emits multiple packets from a continuous stream', () => {
    const demuxer = new ScrcpyDemuxer()
    const packets: VideoPacket[] = []
    demuxer.on('packet', (p: VideoPacket) => packets.push(p))

    const frame1 = Buffer.alloc(100, 0xaa)
    const frame2 = Buffer.alloc(200, 0xbb)
    const frame3 = Buffer.alloc(50, 0xcc)

    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(640, 480),
      buildPacket(frame1, { config: true }),
      buildPacket(frame2, { keyFrame: true }),
      buildPacket(frame3, { pts: 33333n }),
    ])

    demuxer.feed(stream)

    expect(packets).toHaveLength(3)
    expect(packets[0]!.isConfig).toBe(true)
    expect(packets[1]!.isKeyFrame).toBe(true)
    expect(packets[2]!.isConfig).toBe(false)
    expect(packets[2]!.isKeyFrame).toBe(false)
    expect(packets[2]!.data.length).toBe(50)
    expect(packets[2]!.pts).toBe(33333n)
  })

  it('handles multiple session metas (rotation)', () => {
    const demuxer = new ScrcpyDemuxer()
    const sessions: SessionInfo[] = []
    const packets: VideoPacket[] = []
    demuxer.on('session', (s: SessionInfo) => sessions.push(s))
    demuxer.on('packet', (p: VideoPacket) => packets.push(p))

    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(1080, 1920),
      buildPacket(Buffer.from([0xaa]), { config: true }),
      buildPacket(Buffer.from([0xbb]), { keyFrame: true }),
      // rotation: new session
      buildSessionMeta(1920, 1080),
      buildPacket(Buffer.from([0xcc]), { config: true }),
      buildPacket(Buffer.from([0xdd]), { keyFrame: true }),
    ])

    demuxer.feed(stream)

    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toEqual({ width: 1080, height: 1920 })
    expect(sessions[1]).toEqual({ width: 1920, height: 1080 })
    expect(packets).toHaveLength(4)
  })

  it('does not emit if codec_id is incomplete', () => {
    const demuxer = new ScrcpyDemuxer()
    const codecSpy = vi.fn()
    const packetSpy = vi.fn()
    demuxer.on('codec', codecSpy)
    demuxer.on('packet', packetSpy)

    demuxer.feed(Buffer.from([0x68, 0x32]))

    expect(codecSpy).not.toHaveBeenCalled()
    expect(packetSpy).not.toHaveBeenCalled()
  })

  it('does not emit if header is incomplete', () => {
    const demuxer = new ScrcpyDemuxer()
    const packetSpy = vi.fn()
    demuxer.on('packet', packetSpy)

    demuxer.feed(Buffer.concat([buildCodecId(), Buffer.alloc(8, 0)]))
    expect(packetSpy).not.toHaveBeenCalled()

    const rest = Buffer.allocUnsafe(4)
    rest.writeUInt32BE(0, 0)
    demuxer.feed(rest)
    expect(packetSpy).toHaveBeenCalledTimes(1)
    expect(packetSpy.mock.calls[0][0].data.length).toBe(0)
  })

  it('reset clears state and listeners', () => {
    const demuxer = new ScrcpyDemuxer()
    const spy = vi.fn()
    demuxer.on('packet', spy)

    demuxer.feed(buildCodecId())
    demuxer.reset()

    const payload = Buffer.from([1, 2, 3])
    demuxer.feed(Buffer.concat([
      buildCodecId(),
      buildSessionMeta(100, 100),
      buildPacket(payload),
    ]))

    expect(spy).not.toHaveBeenCalled()
  })

  it('correctly handles large PTS values', () => {
    const demuxer = new ScrcpyDemuxer()
    const packets: VideoPacket[] = []
    demuxer.on('packet', (p: VideoPacket) => packets.push(p))

    // Max PTS uses lower 61 bits
    const largePts = (1n << 61n) - 1n
    const stream = Buffer.concat([
      buildCodecId(),
      buildSessionMeta(640, 480),
      buildPacket(Buffer.from([0xaa]), { pts: largePts }),
    ])

    demuxer.feed(stream)

    expect(packets).toHaveLength(1)
    expect(packets[0]!.isConfig).toBe(false)
    expect(packets[0]!.isKeyFrame).toBe(false)
    expect(packets[0]!.pts).toBe(largePts)
  })
})
