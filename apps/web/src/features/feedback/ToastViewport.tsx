import { useEffect, useState } from 'react'
import { subscribeToasts, type Toast } from './feedbackStore'

export function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  return (
    <div style={{ position: 'fixed', top: 12, right: 12, display: 'grid', gap: 8, zIndex: 50 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            minWidth: 220,
            borderRadius: 10,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            background: toast.type === 'error' ? '#3a1820' : toast.type === 'success' ? '#143524' : 'var(--surface)',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
