import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'
import { AppShell } from './AppShell'
import { fetchMe } from '../features/auth/authClient'
import { LoginPage } from '../features/auth/LoginPage'
import { useConnectionStore } from '../store/connectionStore'

export function AppRoutes() {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const setUsername = useConnectionStore((s) => s.setUsername)

  useEffect(() => {
    if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
      setAuthed(true)
      setUsername('dev')
      setChecking(false)
      return
    }

    void (async () => {
      const user = await fetchMe()
      setAuthed(Boolean(user))
      if (user) setUsername(user.username)
      setChecking(false)
    })()
  }, [setUsername])

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-card border-border text-foreground',
        }}
        theme="dark"
      />
      {checking ? (
        <main className="flex h-full items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      ) : authed ? (
        <AppShell />
      ) : (
        <LoginPage onSuccess={() => setAuthed(true)} />
      )}
    </>
  )
}
