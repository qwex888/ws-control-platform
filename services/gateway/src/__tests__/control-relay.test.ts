/**
 * Byte-level validation of all scrcpy v4.0 control messages.
 *
 * Reference:
 *   - C serialization:  scrcpy/app/src/control_msg.c  sc_control_msg_serialize()
 *   - Java reader:      scrcpy/server/.../ControlMessageReader.java
 *
 * Each test group verifies total buffer size, type byte, and per-field
 * offsets / values to prevent stream misalignment bugs.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { PassThrough } from 'node:stream'
import { ControlRelay, type TouchEvent, type ScrollEvent, type KeyEvent } from '../stream/controlRelay'

function createRelay(): { relay: ControlRelay; chunks: Buffer[] } {
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  const relay = new ControlRelay()
  relay.attach(stream as any)
  return { relay, chunks }
}

function collect(chunks: Buffer[]): Buffer {
  return Buffer.concat(chunks)
}

// ── scrcpy v4.0 TYPE constants (must match ControlMessage.java) ─────────────

const TYPE_INJECT_KEYCODE = 0
const TYPE_INJECT_TEXT = 1
const TYPE_INJECT_TOUCH_EVENT = 2
const TYPE_INJECT_SCROLL_EVENT = 3
const TYPE_BACK_OR_SCREEN_ON = 4
const TYPE_SET_CLIPBOARD = 9
const TYPE_UHID_CREATE = 12
const TYPE_UHID_INPUT = 13
const TYPE_UHID_DESTROY = 14

// ─────────────────────────────────────────────────────────────────────────────

describe('INJECT_KEYCODE (type=0, 14 bytes)', () => {
  it('serializes key-down with correct size and fields', () => {
    const { relay, chunks } = createRelay()
    relay.injectKeycode({ action: 'down', keycode: 66, repeat: 0, metaState: 0 })

    const buf = collect(chunks)
    expect(buf.length).toBe(14)
    expect(buf.readUInt8(0)).toBe(TYPE_INJECT_KEYCODE)
    expect(buf.readUInt8(1)).toBe(0) // ACTION_DOWN
    expect(buf.readInt32BE(2)).toBe(66) // KEYCODE_ENTER
    expect(buf.readInt32BE(6)).toBe(0) // repeat
    expect(buf.readInt32BE(10)).toBe(0) // metaState
  })

  it('serializes key-up with metaState', () => {
    const { relay, chunks } = createRelay()
    relay.injectKeycode({ action: 'up', keycode: 62, metaState: 0x1000 })

    const buf = collect(chunks)
    expect(buf.length).toBe(14)
    expect(buf.readUInt8(1)).toBe(1) // ACTION_UP
    expect(buf.readInt32BE(2)).toBe(62) // KEYCODE_SPACE
    expect(buf.readInt32BE(10)).toBe(0x1000) // META_CTRL_ON
  })
})

describe('INJECT_TEXT (type=1, 1+4+N bytes)', () => {
  it('serializes ASCII text', () => {
    const { relay, chunks } = createRelay()
    relay.injectText('hello')

    const buf = collect(chunks)
    const textBytes = Buffer.from('hello', 'utf-8')
    expect(buf.length).toBe(1 + 4 + textBytes.length)
    expect(buf.readUInt8(0)).toBe(TYPE_INJECT_TEXT)
    expect(buf.readUInt32BE(1)).toBe(textBytes.length)
    expect(buf.subarray(5).toString('utf-8')).toBe('hello')
  })

  it('serializes UTF-8 text with correct byte length', () => {
    const { relay, chunks } = createRelay()
    const text = '你好'
    relay.injectText(text)

    const buf = collect(chunks)
    const textBytes = Buffer.from(text, 'utf-8')
    expect(buf.length).toBe(1 + 4 + textBytes.length)
    expect(buf.readUInt32BE(1)).toBe(textBytes.length) // byte length, not char length
    expect(buf.subarray(5).toString('utf-8')).toBe(text)
  })
})

describe('INJECT_TOUCH_EVENT (type=2, 32 bytes)', () => {
  it('serializes touch-down with all fields at correct offsets', () => {
    const { relay, chunks } = createRelay()
    relay.injectTouch({
      action: 'down', x: 100, y: 200,
      width: 1080, height: 1920,
      pointerId: 42, pressure: 1.0,
    })

    const buf = collect(chunks)
    expect(buf.length).toBe(32)
    expect(buf.readUInt8(0)).toBe(TYPE_INJECT_TOUCH_EVENT) // type
    expect(buf.readUInt8(1)).toBe(0) // ACTION_DOWN
    expect(buf.readBigUInt64BE(2)).toBe(42n) // pointerId
    expect(buf.readInt32BE(10)).toBe(100) // x
    expect(buf.readInt32BE(14)).toBe(200) // y
    expect(buf.readUInt16BE(18)).toBe(1080) // width
    expect(buf.readUInt16BE(20)).toBe(1920) // height
    expect(buf.readUInt16BE(22)).toBe(0xFFFF) // pressure (1.0 * 0xFFFF)
    expect(buf.readInt32BE(24)).toBe(0) // actionButton
    expect(buf.readInt32BE(28)).toBe(0) // buttons
  })

  it('serializes touch-up with zero pressure', () => {
    const { relay, chunks } = createRelay()
    relay.injectTouch({
      action: 'up', x: 50, y: 60,
      width: 460, height: 1080,
      pointerId: 7, pressure: 0,
    })

    const buf = collect(chunks)
    expect(buf.length).toBe(32)
    expect(buf.readUInt8(1)).toBe(1) // ACTION_UP
    expect(buf.readUInt16BE(22)).toBe(0) // pressure 0
  })

  it('serializes touch-move', () => {
    const { relay, chunks } = createRelay()
    relay.injectTouch({
      action: 'move', x: 300, y: 400,
      width: 460, height: 1080,
    })

    const buf = collect(chunks)
    expect(buf.readUInt8(1)).toBe(2) // ACTION_MOVE
    expect(buf.readBigUInt64BE(2)).toBe(0n) // default pointerId
    expect(buf.readUInt16BE(22)).toBe(0xFFFF) // default pressure 1.0
  })
})

describe('INJECT_SCROLL_EVENT (type=3, 21 bytes)', () => {
  it('serializes scroll with i16fp values and correct total size', () => {
    const { relay, chunks } = createRelay()
    relay.injectScroll({
      x: 200, y: 400, width: 460, height: 1080,
      hscroll: 0, vscroll: -1, buttons: 0,
    })

    const buf = collect(chunks)
    expect(buf.length).toBe(21)
    expect(buf.readUInt8(0)).toBe(TYPE_INJECT_SCROLL_EVENT)
    expect(buf.readInt32BE(1)).toBe(200) // x
    expect(buf.readInt32BE(5)).toBe(400) // y
    expect(buf.readUInt16BE(9)).toBe(460) // width
    expect(buf.readUInt16BE(11)).toBe(1080) // height
    expect(buf.readInt16BE(13)).toBe(0) // hscroll i16fp(0)
    expect(buf.readInt16BE(15)).toBe(-0x7FFF) // vscroll i16fp(-1)
    expect(buf.readInt32BE(17)).toBe(0) // buttons
  })

  it('encodes vscroll=+1 as i16fp 0x7FFF', () => {
    const { relay, chunks } = createRelay()
    relay.injectScroll({
      x: 0, y: 0, width: 100, height: 100,
      hscroll: 1, vscroll: 1,
    })

    const buf = collect(chunks)
    expect(buf.readInt16BE(13)).toBe(0x7FFF) // hscroll i16fp(+1)
    expect(buf.readInt16BE(15)).toBe(0x7FFF) // vscroll i16fp(+1)
  })

  it('encodes fractional scroll correctly', () => {
    const { relay, chunks } = createRelay()
    relay.injectScroll({
      x: 0, y: 0, width: 100, height: 100,
      hscroll: 0.5, vscroll: -0.5,
    })

    const buf = collect(chunks)
    // i16fp(0.5) = round(0.5 * 0x7FFF) = round(16383.5) = 16384 = 0x4000
    expect(buf.readInt16BE(13)).toBe(0x4000)
    // i16fp(-0.5) = -round(0.5 * 0x7FFF) = -16384
    expect(buf.readInt16BE(15)).toBe(-0x4000)
  })

  it('does not leak extra bytes that corrupt the stream', () => {
    const { relay, chunks } = createRelay()

    relay.injectScroll({
      x: 306, y: 556, width: 460, height: 1080,
      hscroll: 0, vscroll: -1, buttons: 0,
    })
    relay.injectKeycode({ action: 'down', keycode: 66 })

    const buf = collect(chunks)
    // scroll (21 bytes) + keycode (14 bytes) = 35 total
    expect(buf.length).toBe(21 + 14)
    // The second message must start with TYPE_INJECT_KEYCODE at offset 21
    expect(buf.readUInt8(21)).toBe(TYPE_INJECT_KEYCODE)
  })
})

describe('BACK_OR_SCREEN_ON (type=4, 2 bytes)', () => {
  it('turnScreenOn sends DOWN + UP (2 + 2 = 4 bytes)', () => {
    const { relay, chunks } = createRelay()
    relay.turnScreenOn()

    const buf = collect(chunks)
    expect(buf.length).toBe(4)

    expect(buf.readUInt8(0)).toBe(TYPE_BACK_OR_SCREEN_ON)
    expect(buf.readUInt8(1)).toBe(0) // ACTION_DOWN

    expect(buf.readUInt8(2)).toBe(TYPE_BACK_OR_SCREEN_ON)
    expect(buf.readUInt8(3)).toBe(1) // ACTION_UP
  })
})

describe('SET_CLIPBOARD (type=9, 1+8+1+4+N bytes)', () => {
  it('serializes clipboard with paste=true', () => {
    const { relay, chunks } = createRelay()
    relay.setClipboard('test', true)

    const textBytes = Buffer.from('test', 'utf-8')
    const buf = collect(chunks)
    expect(buf.length).toBe(1 + 8 + 1 + 4 + textBytes.length)
    expect(buf.readUInt8(0)).toBe(TYPE_SET_CLIPBOARD)
    expect(buf.readBigUInt64BE(1)).toBe(1n) // first sequence
    expect(buf.readUInt8(9)).toBe(1) // paste = true
    expect(buf.readUInt32BE(10)).toBe(textBytes.length)
    expect(buf.subarray(14).toString('utf-8')).toBe('test')
  })

  it('serializes clipboard with paste=false', () => {
    const { relay, chunks } = createRelay()
    relay.setClipboard('abc', false)

    const buf = collect(chunks)
    expect(buf.readUInt8(9)).toBe(0) // paste = false
  })

  it('increments sequence on successive calls', () => {
    const { relay, chunks } = createRelay()
    relay.setClipboard('a')
    relay.setClipboard('b')

    const buf = collect(chunks)
    const first = buf.subarray(0, 1 + 8 + 1 + 4 + 1)
    const second = buf.subarray(first.length)
    expect(first.readBigUInt64BE(1)).toBe(1n)
    expect(second.readBigUInt64BE(1)).toBe(2n)
  })
})

describe('UHID_CREATE (type=12, variable)', () => {
  it('serializes with vendor/product ids and report descriptor', () => {
    const { relay, chunks } = createRelay()
    const desc = Buffer.from([0x05, 0x01, 0x09, 0x06])
    relay.uhidCreate(1, desc, '', 0x1234, 0x5678)

    const buf = collect(chunks)
    // type(1) + id(2) + vendorId(2) + productId(2) + nameLen(1) + name(0) + descSize(2) + desc(4)
    expect(buf.length).toBe(1 + 2 + 2 + 2 + 1 + 0 + 2 + 4)
    expect(buf.readUInt8(0)).toBe(TYPE_UHID_CREATE)
    expect(buf.readUInt16BE(1)).toBe(1) // id
    expect(buf.readUInt16BE(3)).toBe(0x1234) // vendorId
    expect(buf.readUInt16BE(5)).toBe(0x5678) // productId
    expect(buf.readUInt8(7)).toBe(0) // nameLen
    expect(buf.readUInt16BE(8)).toBe(4) // descSize
    expect(buf.subarray(10, 14)).toEqual(desc)
  })

  it('serializes with name', () => {
    const { relay, chunks } = createRelay()
    const desc = Buffer.from([0xC0])
    relay.uhidCreate(2, desc, 'kbd')

    const buf = collect(chunks)
    const nameBytes = Buffer.from('kbd', 'utf-8')
    expect(buf.length).toBe(1 + 2 + 2 + 2 + 1 + nameBytes.length + 2 + 1)
    expect(buf.readUInt8(7)).toBe(nameBytes.length) // nameLen = 3
    expect(buf.subarray(8, 8 + nameBytes.length).toString('utf-8')).toBe('kbd')
    expect(buf.readUInt16BE(8 + nameBytes.length)).toBe(1) // descSize
  })

  it('matches the real keyboard descriptor size (63 bytes)', () => {
    const { relay, chunks } = createRelay()
    // Simulate the actual keyboard report descriptor (63 bytes)
    const desc = Buffer.alloc(63, 0xAA)
    relay.uhidCreate(1, desc)

    const buf = collect(chunks)
    expect(buf.length).toBe(1 + 2 + 2 + 2 + 1 + 0 + 2 + 63) // = 73
    expect(buf.readUInt16BE(8)).toBe(63) // descSize
  })
})

describe('UHID_INPUT (type=13, 1+2+2+N bytes)', () => {
  it('serializes 8-byte keyboard report', () => {
    const { relay, chunks } = createRelay()
    const report = Buffer.from([0x02, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00])
    relay.uhidInput(1, report)

    const buf = collect(chunks)
    expect(buf.length).toBe(1 + 2 + 2 + 8)
    expect(buf.readUInt8(0)).toBe(TYPE_UHID_INPUT)
    expect(buf.readUInt16BE(1)).toBe(1) // id
    expect(buf.readUInt16BE(3)).toBe(8) // size
    expect(buf.subarray(5)).toEqual(report)
  })
})

describe('UHID_DESTROY (type=14, 3 bytes)', () => {
  it('serializes correctly with type=14', () => {
    const { relay, chunks } = createRelay()
    relay.uhidDestroy(1)

    const buf = collect(chunks)
    expect(buf.length).toBe(3)
    expect(buf.readUInt8(0)).toBe(TYPE_UHID_DESTROY)
    expect(buf.readUInt16BE(1)).toBe(1)
  })
})

describe('stream alignment: multi-message sequences', () => {
  it('turnScreenOn + uhidCreate + touch + scroll stays aligned', () => {
    const { relay, chunks } = createRelay()

    relay.turnScreenOn() // 2+2 = 4
    relay.uhidCreate(1, Buffer.alloc(63), '') // 73
    relay.injectTouch({
      action: 'down', x: 100, y: 200,
      width: 460, height: 1080,
    }) // 32
    relay.injectScroll({
      x: 100, y: 200, width: 460, height: 1080,
      hscroll: 0, vscroll: -1,
    }) // 21

    const buf = collect(chunks)
    const expectedTotal = 4 + 73 + 32 + 21
    expect(buf.length).toBe(expectedTotal)

    let off = 0

    // BACK_OR_SCREEN_ON DOWN
    expect(buf.readUInt8(off)).toBe(TYPE_BACK_OR_SCREEN_ON)
    off += 2
    // BACK_OR_SCREEN_ON UP
    expect(buf.readUInt8(off)).toBe(TYPE_BACK_OR_SCREEN_ON)
    off += 2
    // UHID_CREATE
    expect(buf.readUInt8(off)).toBe(TYPE_UHID_CREATE)
    off += 73
    // INJECT_TOUCH
    expect(buf.readUInt8(off)).toBe(TYPE_INJECT_TOUCH_EVENT)
    off += 32
    // INJECT_SCROLL
    expect(buf.readUInt8(off)).toBe(TYPE_INJECT_SCROLL_EVENT)
    off += 21

    expect(off).toBe(expectedTotal)
  })

  it('repeated scroll messages maintain alignment', () => {
    const { relay, chunks } = createRelay()

    for (let i = 0; i < 10; i++) {
      relay.injectScroll({
        x: 100, y: 200, width: 460, height: 1080,
        hscroll: 0, vscroll: -1,
      })
    }

    const buf = collect(chunks)
    expect(buf.length).toBe(21 * 10)

    for (let i = 0; i < 10; i++) {
      expect(buf.readUInt8(i * 21)).toBe(TYPE_INJECT_SCROLL_EVENT)
    }
  })

  it('interleaved scroll + touch stay aligned', () => {
    const { relay, chunks } = createRelay()

    for (let i = 0; i < 5; i++) {
      relay.injectScroll({
        x: 100, y: 200, width: 460, height: 1080,
        hscroll: 0, vscroll: -0.5,
      })
      relay.injectTouch({
        action: 'move', x: 100 + i, y: 200,
        width: 460, height: 1080,
      })
    }

    const buf = collect(chunks)
    expect(buf.length).toBe((21 + 32) * 5)

    let off = 0
    for (let i = 0; i < 5; i++) {
      expect(buf.readUInt8(off)).toBe(TYPE_INJECT_SCROLL_EVENT)
      off += 21
      expect(buf.readUInt8(off)).toBe(TYPE_INJECT_TOUCH_EVENT)
      off += 32
    }
  })
})
