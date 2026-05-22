import type { ControlRelay } from './controlRelay'

const UHID_KEYBOARD_ID = 1

/**
 * Standard USB HID keyboard report descriptor.
 * Copied from scrcpy SC_HID_KEYBOARD_REPORT_DESC (hid_keyboard.c).
 * Defines an 8-byte input report: [modifier, reserved, key1..key6]
 *
 * SC_HID_KEYBOARD_KEYS = 102 (Usage/Logical Maximum = 101 = 0x65)
 */
const SC_HID_KEYBOARD_KEYS = 102

// prettier-ignore
const KEYBOARD_REPORT_DESC = Buffer.from([
  0x05, 0x01,       // Usage Page (Generic Desktop)
  0x09, 0x06,       // Usage (Keyboard)
  0xA1, 0x01,       // Collection (Application)

  0x05, 0x07,       //   Usage Page (Key Codes)
  0x19, 0xE0,       //   Usage Minimum (224)
  0x29, 0xE7,       //   Usage Maximum (231)
  0x15, 0x00,       //   Logical Minimum (0)
  0x25, 0x01,       //   Logical Maximum (1)
  0x75, 0x01,       //   Report Size (1)
  0x95, 0x08,       //   Report Count (8)
  0x81, 0x02,       //   Input (Data, Variable, Absolute): Modifier byte

  0x75, 0x08,       //   Report Size (8)
  0x95, 0x01,       //   Report Count (1)
  0x81, 0x01,       //   Input (Constant): Reserved byte

  0x05, 0x08,       //   Usage Page (LEDs)
  0x19, 0x01,       //   Usage Minimum (1)
  0x29, 0x05,       //   Usage Maximum (5)
  0x75, 0x01,       //   Report Size (1)
  0x95, 0x05,       //   Report Count (5)
  0x91, 0x02,       //   Output (Data, Variable, Absolute): LED report

  0x75, 0x03,       //   Report Size (3)
  0x95, 0x01,       //   Report Count (1)
  0x91, 0x01,       //   Output (Constant): LED report padding

  0x05, 0x07,       //   Usage Page (Key Codes)
  0x19, 0x00,       //   Usage Minimum (0)
  0x29, SC_HID_KEYBOARD_KEYS - 1,  //   Usage Maximum (101)
  0x15, 0x00,       //   Logical Minimum (0)
  0x25, SC_HID_KEYBOARD_KEYS - 1,  //   Logical Maximum (101)
  0x75, 0x08,       //   Report Size (8)
  0x95, 0x06,       //   Report Count (6)
  0x81, 0x00,       //   Input (Data, Array): Keys

  0xC0,             // End Collection
])

/** HID modifier bitmask constants */
const MOD_LEFT_CTRL  = 1 << 0
const MOD_LEFT_SHIFT = 1 << 1
const MOD_LEFT_ALT   = 1 << 2
const MOD_LEFT_META  = 1 << 3

export type HidModifiers = {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

/**
 * Manages a UHID virtual keyboard on the Android device.
 * The keyboard is created on attach and destroyed on detach.
 * Key presses are sent as standard 8-byte HID reports.
 */
export class UhidKeyboard {
  private relay: ControlRelay | null = null
  private created = false
  private pressedKeys = new Set<number>()

  attach(relay: ControlRelay) {
    this.relay = relay
    relay.uhidCreate(UHID_KEYBOARD_ID, KEYBOARD_REPORT_DESC)
    this.created = true
  }

  detach() {
    if (this.relay && this.created) {
      this.releaseAll()
      this.relay.uhidDestroy(UHID_KEYBOARD_ID)
      this.created = false
    }
    this.relay = null
  }

  pressKey(hidKeycode: number, modifiers?: HidModifiers) {
    if (!this.relay || !this.created) return
    this.pressedKeys.add(hidKeycode)
    this.sendReport(modifiers)
  }

  releaseKey(hidKeycode: number, modifiers?: HidModifiers) {
    if (!this.relay || !this.created) return
    this.pressedKeys.delete(hidKeycode)
    this.sendReport(modifiers)
  }

  releaseAll() {
    if (!this.relay || !this.created) return
    this.pressedKeys.clear()
    this.sendReport()
  }

  private sendReport(modifiers?: HidModifiers) {
    if (!this.relay) return

    let mod = 0
    if (modifiers?.ctrl)  mod |= MOD_LEFT_CTRL
    if (modifiers?.shift) mod |= MOD_LEFT_SHIFT
    if (modifiers?.alt)   mod |= MOD_LEFT_ALT
    if (modifiers?.meta)  mod |= MOD_LEFT_META

    const report = Buffer.alloc(8)
    report.writeUInt8(mod, 0)
    // byte 1 = reserved (0)
    const keys = Array.from(this.pressedKeys).slice(0, 6)
    for (let i = 0; i < keys.length; i++) {
      report.writeUInt8(keys[i]!, 2 + i)
    }

    this.relay.uhidInput(UHID_KEYBOARD_ID, report)
  }
}

/**
 * DOM KeyboardEvent.code → USB HID Usage ID mapping.
 * Based on USB HID Usage Tables (Keyboard/Keypad Page 0x07).
 */
export const DOM_CODE_TO_HID: Record<string, number> = {
  KeyA: 0x04, KeyB: 0x05, KeyC: 0x06, KeyD: 0x07,
  KeyE: 0x08, KeyF: 0x09, KeyG: 0x0A, KeyH: 0x0B,
  KeyI: 0x0C, KeyJ: 0x0D, KeyK: 0x0E, KeyL: 0x0F,
  KeyM: 0x10, KeyN: 0x11, KeyO: 0x12, KeyP: 0x13,
  KeyQ: 0x14, KeyR: 0x15, KeyS: 0x16, KeyT: 0x17,
  KeyU: 0x18, KeyV: 0x19, KeyW: 0x1A, KeyX: 0x1B,
  KeyY: 0x1C, KeyZ: 0x1D,
  Digit1: 0x1E, Digit2: 0x1F, Digit3: 0x20, Digit4: 0x21,
  Digit5: 0x22, Digit6: 0x23, Digit7: 0x24, Digit8: 0x25,
  Digit9: 0x26, Digit0: 0x27,
  Enter: 0x28, Escape: 0x29, Backspace: 0x2A, Tab: 0x2B,
  Space: 0x2C,
  Minus: 0x2D, Equal: 0x2E, BracketLeft: 0x2F, BracketRight: 0x30,
  Backslash: 0x31, Semicolon: 0x33, Quote: 0x34,
  Backquote: 0x35, Comma: 0x36, Period: 0x37, Slash: 0x38,
  CapsLock: 0x39,
  F1: 0x3A, F2: 0x3B, F3: 0x3C, F4: 0x3D,
  F5: 0x3E, F6: 0x3F, F7: 0x40, F8: 0x41,
  F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
  Insert: 0x49, Home: 0x4A, PageUp: 0x4B,
  Delete: 0x4C, End: 0x4D, PageDown: 0x4E,
  ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
  NumLock: 0x53,
  NumpadDivide: 0x54, NumpadMultiply: 0x55, NumpadSubtract: 0x56,
  NumpadAdd: 0x57, NumpadEnter: 0x58,
  Numpad1: 0x59, Numpad2: 0x5A, Numpad3: 0x5B, Numpad4: 0x5C,
  Numpad5: 0x5D, Numpad6: 0x5E, Numpad7: 0x5F, Numpad8: 0x60,
  Numpad9: 0x61, Numpad0: 0x62, NumpadDecimal: 0x63,
  ContextMenu: 0x65,
}
