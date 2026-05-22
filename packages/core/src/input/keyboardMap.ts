export type KeyEventPayload = {
  code: string
  action: 'down' | 'up'
}

export const mapKeyboardKey = (key: string): string | null => {
  if (/^[a-z]$/i.test(key)) {
    return `KEY_${key.toUpperCase()}`
  }
  if (/^[0-9]$/.test(key)) {
    return `DIGIT_${key}`
  }

  const fixed: Record<string, string> = {
    Enter: 'ENTER',
    Backspace: 'BACKSPACE',
    Tab: 'TAB',
    Escape: 'ESCAPE',
    ArrowUp: 'ARROW_UP',
    ArrowDown: 'ARROW_DOWN',
    ArrowLeft: 'ARROW_LEFT',
    ArrowRight: 'ARROW_RIGHT',
  }

  return fixed[key] ?? null
}
