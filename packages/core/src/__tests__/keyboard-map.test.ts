import { describe, expect, it } from 'vitest'
import { mapKeyboardKey } from '../input/keyboardMap'

describe('keyboard map', () => {
  it('maps alpha and fixed keys', () => {
    expect(mapKeyboardKey('a')).toBe('KEY_A')
    expect(mapKeyboardKey('Enter')).toBe('ENTER')
  })
})
