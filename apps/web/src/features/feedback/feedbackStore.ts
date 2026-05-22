export type Toast = { id: string; type: 'success' | 'error' | 'info'; message: string }

let listeners: Array<(toasts: Toast[]) => void> = []
let toasts: Toast[] = []

const emit = () => listeners.forEach((l) => l(toasts))

export const subscribeToasts = (listener: (toasts: Toast[]) => void) => {
  listeners = [...listeners, listener]
  listener(toasts)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export const pushToast = (type: Toast['type'], message: string) => {
  const id = `${Date.now()}-${Math.random()}`
  toasts = [...toasts, { id, type, message }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 2400)
}
