import type { Duplex } from 'node:stream'

/**
 * scrcpy 4.0 control message types.
 * Must match ControlMessage.java constants.
 */
const TYPE_INJECT_KEYCODE = 0
const TYPE_INJECT_TEXT = 1
const TYPE_INJECT_TOUCH_EVENT = 2
const TYPE_INJECT_SCROLL_EVENT = 3
const TYPE_BACK_OR_SCREEN_ON = 4
const TYPE_SET_CLIPBOARD = 9
const TYPE_UHID_CREATE = 12
const TYPE_UHID_INPUT = 13
const TYPE_UHID_DESTROY = 14

const AMOTION_EVENT_ACTION_DOWN = 0
const AMOTION_EVENT_ACTION_UP = 1
const AMOTION_EVENT_ACTION_MOVE = 2

export type TouchEvent = {
  action: 'down' | 'up' | 'move'
  x: number
  y: number
  width: number
  height: number
  pointerId?: number
  pressure?: number
}

export type ScrollEvent = {
  x: number
  y: number
  width: number
  height: number
  hscroll: number
  vscroll: number
  buttons?: number
}

export type KeyEvent = {
  action: 'down' | 'up'
  keycode: number
  repeat?: number
  metaState?: number
}

export type ControlAction =
  | 'home' | 'back' | 'menu' | 'recent'
  | 'power' | 'vol-up' | 'vol-down'
  | 'rotate' | 'screenshot' | 'copy' | 'paste'
  | 'ime-switch' | 'lang-toggle'

const KEYCODE_MAP: Record<ControlAction, number> = {
  home: 3,
  back: 4,
  menu: 82,
  recent: 187,
  power: 26,
  'vol-up': 24,
  'vol-down': 25,
  rotate: -1,
  screenshot: -2,
  copy: -3,
  paste: -4,
  'ime-switch': 204, // KEYCODE_LANGUAGE_SWITCH
  'lang-toggle': -5,
}

export class ControlRelay {
  private stream: Duplex | null = null
  private clipboardSeq = 0n

  attach(controlStream: Duplex) {
    this.stream = controlStream
  }

  detach() {
    this.stream = null
  }

  /**
   * scrcpy 4.0 INJECT_TOUCH_EVENT (type=2), 32 bytes
   */
  injectTouch(event: TouchEvent) {
    if (!this.stream) return

    const action = event.action === 'down'
      ? AMOTION_EVENT_ACTION_DOWN
      : event.action === 'up'
        ? AMOTION_EVENT_ACTION_UP
        : AMOTION_EVENT_ACTION_MOVE

    const x = clampI32(event.x)
    const y = clampI32(event.y)
    const width = clampU16(event.width)
    const height = clampU16(event.height)
    const pressure = clampU16(Math.round((event.pressure ?? 1.0) * 0xFFFF))

    const buf = Buffer.alloc(32)
    let offset = 0
    offset = buf.writeUInt8(TYPE_INJECT_TOUCH_EVENT, offset)
    offset = buf.writeUInt8(action, offset)
    buf.writeBigUInt64BE(BigInt(event.pointerId ?? 0), offset); offset += 8
    offset = buf.writeInt32BE(x, offset)
    offset = buf.writeInt32BE(y, offset)
    offset = buf.writeUInt16BE(width, offset)
    offset = buf.writeUInt16BE(height, offset)
    offset = buf.writeUInt16BE(pressure, offset)
    offset = buf.writeInt32BE(0, offset)
    buf.writeInt32BE(0, offset)

    this.stream.write(buf)
  }

  /**
   * scrcpy 4.0 INJECT_SCROLL_EVENT (type=3), 21 bytes
   *
   * Position (12 bytes) + hscroll(i16fp) + vscroll(i16fp) + buttons(i32)
   * i16fp: float in [-1,1] encoded as fixed-point int16 (value * 2^15)
   * scrcpy v4.0 client normalizes scroll values to [-1,1] before encoding
   */
  injectScroll(event: ScrollEvent) {
    if (!this.stream) return

    const x = clampI32(event.x)
    const y = clampI32(event.y)
    const width = clampU16(event.width)
    const height = clampU16(event.height)
    const hscroll = floatToI16fp(Math.max(-1, Math.min(1, event.hscroll)))
    const vscroll = floatToI16fp(Math.max(-1, Math.min(1, event.vscroll)))

    const buf = Buffer.alloc(21)
    let offset = 0
    offset = buf.writeUInt8(TYPE_INJECT_SCROLL_EVENT, offset)
    offset = buf.writeInt32BE(x, offset)
    offset = buf.writeInt32BE(y, offset)
    offset = buf.writeUInt16BE(width, offset)
    offset = buf.writeUInt16BE(height, offset)
    offset = buf.writeInt16BE(hscroll, offset)
    offset = buf.writeInt16BE(vscroll, offset)
    buf.writeInt32BE(event.buttons ?? 0, offset)

    this.stream.write(buf)
  }

  /**
   * scrcpy 4.0 INJECT_KEYCODE (type=0), 14 bytes
   */
  injectKeycode(event: KeyEvent) {
    if (!this.stream) return

    const action = event.action === 'down' ? 0 : 1
    const buf = Buffer.alloc(14)
    buf.writeUInt8(TYPE_INJECT_KEYCODE, 0)
    buf.writeUInt8(action, 1)
    buf.writeInt32BE(event.keycode, 2)
    buf.writeInt32BE(event.repeat ?? 0, 6)
    buf.writeInt32BE(event.metaState ?? 0, 10)

    this.stream.write(buf)
  }

  injectAction(action: ControlAction) {
    if (action === 'lang-toggle') {
      this.injectLangToggle()
      return
    }

    const keycode = KEYCODE_MAP[action]
    if (keycode === undefined || keycode < 0) {
      if (action === 'back') {
        this.injectBackOrScreenOn(AMOTION_EVENT_ACTION_DOWN)
        this.injectBackOrScreenOn(AMOTION_EVENT_ACTION_UP)
      }
      return
    }
    this.injectKeycode({ action: 'down', keycode })
    this.injectKeycode({ action: 'up', keycode })
  }

  /**
   * scrcpy 4.0 INJECT_TEXT (type=1):
   *   0   1   type (=1)
   *   1   4   textLength (UTF-8 byte count, UInt32BE)
   *   5   N   text (UTF-8)
   */
  injectText(text: string) {
    if (!this.stream) return
    const textBuf = Buffer.from(text, 'utf-8')
    const buf = Buffer.alloc(1 + 4 + textBuf.length)
    buf.writeUInt8(TYPE_INJECT_TEXT, 0)
    buf.writeUInt32BE(textBuf.length, 1)
    textBuf.copy(buf, 5)
    this.stream.write(buf)
  }

  /**
   * scrcpy 4.0 SET_CLIPBOARD (type=9):
   *   0   1   type (=9)
   *   1   8   sequence (BigUInt64BE)
   *   9   1   paste flag (1=paste after setting)
   *  10   4   textLength (UTF-8 byte count, UInt32BE)
   *  14   N   text (UTF-8)
   */
  setClipboard(text: string, paste = false) {
    if (!this.stream) return
    this.clipboardSeq++
    const textBuf = Buffer.from(text, 'utf-8')
    const buf = Buffer.alloc(1 + 8 + 1 + 4 + textBuf.length)
    let offset = 0
    offset = buf.writeUInt8(TYPE_SET_CLIPBOARD, offset)
    buf.writeBigUInt64BE(this.clipboardSeq, offset); offset += 8
    offset = buf.writeUInt8(paste ? 1 : 0, offset)
    offset = buf.writeUInt32BE(textBuf.length, offset)
    textBuf.copy(buf, offset)
    this.stream.write(buf)
  }

  /**
   * Smart text send: ASCII → INJECT_TEXT, non-ASCII → SET_CLIPBOARD(paste=true)
   */
  sendText(text: string) {
    if (!text) return
    const isAscii = /^[\x20-\x7E]+$/.test(text)
    if (isAscii) {
      this.injectText(text)
    } else {
      this.setClipboard(text, true)
    }
  }

  /**
   * UHID_CREATE (type=12): create a virtual HID device
   *
   * Must match sc_control_msg_serialize() in scrcpy control_msg.c:
   *   0      1   type (=12)
   *   1      2   id (UInt16BE)
   *   3      2   vendor_id (UInt16BE)
   *   5      2   product_id (UInt16BE)
   *   7      1   nameLength (UInt8 — write_string_tiny)
   *   8      L   name (UTF-8)
   *   8+L    2   reportDescSize (UInt16BE)
   *  10+L    N   reportDescriptor
   */
  uhidCreate(
    id: number,
    reportDescriptor: Buffer,
    name = '',
    vendorId = 0,
    productId = 0,
  ) {
    if (!this.stream) return
    const nameBuf = Buffer.from(name, 'utf-8')
    const nameLen = Math.min(nameBuf.length, 127)
    const buf = Buffer.alloc(1 + 2 + 2 + 2 + 1 + nameLen + 2 + reportDescriptor.length)
    let offset = 0
    offset = buf.writeUInt8(TYPE_UHID_CREATE, offset)
    offset = buf.writeUInt16BE(id, offset)
    offset = buf.writeUInt16BE(vendorId, offset)
    offset = buf.writeUInt16BE(productId, offset)
    offset = buf.writeUInt8(nameLen, offset)
    nameBuf.copy(buf, offset, 0, nameLen); offset += nameLen
    offset = buf.writeUInt16BE(reportDescriptor.length, offset)
    reportDescriptor.copy(buf, offset)
    this.stream.write(buf)
  }

  /**
   * UHID_INPUT (type=13): send a HID input report
   *   0   1   type (=13)
   *   1   2   id (UInt16BE)
   *   3   2   size (UInt16BE)
   *   5   N   report data
   */
  uhidInput(id: number, report: Buffer) {
    if (!this.stream) return
    const buf = Buffer.alloc(1 + 2 + 2 + report.length)
    buf.writeUInt8(TYPE_UHID_INPUT, 0)
    buf.writeUInt16BE(id, 1)
    buf.writeUInt16BE(report.length, 3)
    report.copy(buf, 5)
    this.stream.write(buf)
  }

  /**
   * UHID_DESTROY (type=14): destroy a virtual HID device
   *   0   1   type (=14)
   *   1   2   id (UInt16BE)
   */
  uhidDestroy(id: number) {
    if (!this.stream) return
    const buf = Buffer.alloc(3)
    buf.writeUInt8(TYPE_UHID_DESTROY, 0)
    buf.writeUInt16BE(id, 1)
    this.stream.write(buf)
  }

  /**
   * Send BACK_OR_SCREEN_ON to wake up the device screen.
   * Mirrors what the official scrcpy client does after connection.
   */
  turnScreenOn() {
    this.injectBackOrScreenOn(AMOTION_EVENT_ACTION_DOWN)
    this.injectBackOrScreenOn(AMOTION_EVENT_ACTION_UP)
  }

  private injectLangToggle() {
    // Ctrl+Space：多数中文输入法的中英文切换快捷键
    const KEYCODE_SPACE = 62
    const META_CTRL_ON = 0x1000
    this.injectKeycode({ action: 'down', keycode: KEYCODE_SPACE, metaState: META_CTRL_ON })
    this.injectKeycode({ action: 'up', keycode: KEYCODE_SPACE, metaState: META_CTRL_ON })
  }

  private injectBackOrScreenOn(action: number) {
    if (!this.stream) return
    const buf = Buffer.alloc(2)
    buf.writeUInt8(TYPE_BACK_OR_SCREEN_ON, 0)
    buf.writeUInt8(action, 1)
    this.stream.write(buf)
  }
}

function clampI32(v: number): number {
  if (v < -2147483648) return -2147483648
  if (v > 2147483647) return 2147483647
  return v | 0
}

function clampU16(v: number): number {
  if (v < 0) return 0
  if (v > 0xFFFF) return 0xFFFF
  return v & 0xFFFF
}

/**
 * Convert float in [-1, 1] to scrcpy i16 fixed-point.
 * Matches sc_float_to_i16fp() in scrcpy v4.0 (used for scroll values).
 */
function floatToI16fp(f: number): number {
  const I16_MAX = 0x7FFF
  if (f < 0) {
    return -Math.round(-f * I16_MAX) | 0
  }
  return Math.round(f * I16_MAX) | 0
}
