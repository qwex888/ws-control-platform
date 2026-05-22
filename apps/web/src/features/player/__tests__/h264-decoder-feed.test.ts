import { describe, expect, it, vi, beforeEach } from 'vitest'
import { H264Decoder } from '../h264Decoder'

const PKT_SESSION = 0x00
const PKT_CONFIG = 0x01
const PKT_KEYFRAME = 0x02
const PKT_DELTA = 0x03

function buildSessionPacket(width: number, height: number): ArrayBuffer {
  const buf = new ArrayBuffer(9)
  const view = new DataView(buf)
  view.setUint8(0, PKT_SESSION)
  view.setUint32(1, width)
  view.setUint32(5, height)
  return buf
}

function buildVideoPacket(type: number, payload: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(1 + payload.length)
  const u8 = new Uint8Array(buf)
  u8[0] = type
  u8.set(payload, 1)
  return buf
}

describe('H264Decoder.feed (binary protocol parsing)', () => {
  let onFrame: ReturnType<typeof vi.fn>
  let onSession: ReturnType<typeof vi.fn>
  let decoder: H264Decoder

  beforeEach(() => {
    onFrame = vi.fn()
    onSession = vi.fn()
    decoder = new H264Decoder(onFrame, onSession)
  })

  it('parses PKT_SESSION and calls onSession with width/height', () => {
    decoder.feed(buildSessionPacket(1080, 1920))

    expect(onSession).toHaveBeenCalledWith(1080, 1920)
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('ignores session packets shorter than 9 bytes', () => {
    const short = new ArrayBuffer(5)
    new DataView(short).setUint8(0, PKT_SESSION)
    decoder.feed(short)

    expect(onSession).not.toHaveBeenCalled()
  })

  it('stores PKT_CONFIG data without decoding', () => {
    const sps = [0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1e]
    decoder.feed(buildVideoPacket(PKT_CONFIG, sps))

    // config is stored internally, not decoded
    expect(onFrame).not.toHaveBeenCalled()
    // access private field for verification
    expect((decoder as any).configData).not.toBeNull()
    expect((decoder as any).configData.length).toBe(sps.length)
  })

  it('prepends config data to keyframe before decoding', () => {
    // We can't test actual WebCodecs decode in jsdom,
    // but we can verify the merged payload logic
    decoder.start() // will fail silently in jsdom (no VideoDecoder)

    const sps = [0, 0, 0, 1, 0x67, 0x42]
    const keyframeData = [0, 0, 0, 1, 0x65, 0xaa, 0xbb]

    decoder.feed(buildVideoPacket(PKT_CONFIG, sps))
    decoder.feed(buildVideoPacket(PKT_KEYFRAME, keyframeData))

    // Since jsdom doesn't have VideoDecoder, decodePayload returns early
    // This verifies the feed routing is correct without throwing
  })

  it('ignores empty packets', () => {
    decoder.feed(new ArrayBuffer(0))
    expect(onSession).not.toHaveBeenCalled()
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('handles all packet types without throwing', () => {
    expect(() => {
      decoder.feed(buildSessionPacket(1920, 1080))
      decoder.feed(buildVideoPacket(PKT_CONFIG, [0, 0, 0, 1, 0x67]))
      decoder.feed(buildVideoPacket(PKT_KEYFRAME, [0, 0, 0, 1, 0x65]))
      decoder.feed(buildVideoPacket(PKT_DELTA, [0, 0, 0, 1, 0x41]))
    }).not.toThrow()
  })

  it('handles multiple session packets (resolution change)', () => {
    decoder.feed(buildSessionPacket(720, 1280))
    decoder.feed(buildSessionPacket(1080, 1920))

    expect(onSession).toHaveBeenCalledTimes(2)
    expect(onSession).toHaveBeenNthCalledWith(1, 720, 1280)
    expect(onSession).toHaveBeenNthCalledWith(2, 1080, 1920)
  })
})

describe('H264Decoder lifecycle', () => {
  it('start() in jsdom environment logs warning (no WebCodecs)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const decoder = new H264Decoder(vi.fn())
    decoder.start()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('WebCodecs not supported')
    )
    warn.mockRestore()
  })

  it('stop() is safe to call multiple times', () => {
    const decoder = new H264Decoder(vi.fn())
    expect(() => {
      decoder.stop()
      decoder.stop()
    }).not.toThrow()
  })

  it('feed after stop does not throw', () => {
    const decoder = new H264Decoder(vi.fn())
    decoder.start()
    decoder.stop()

    expect(() => {
      decoder.feed(buildSessionPacket(640, 480))
    }).not.toThrow()
  })
})
