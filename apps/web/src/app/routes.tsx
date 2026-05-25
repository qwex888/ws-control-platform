import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'
import { AppShell } from './AppShell'
import { fetchAuthStatus } from '../features/auth/authClient'
import { LoginPage } from '../features/auth/LoginPage'
import { SetupPage } from '../features/auth/SetupPage'
import { useConnectionStore } from '../store/connectionStore'

type Phase = 'checking' | 'needSetup' | 'needLogin' | 'authed'

export function AppRoutes() {
  const [phase, setPhase] = useState<Phase>('checking')
  const setUsername = useConnectionStore((s) => s.setUsername)

  useEffect(() => {
    if (import.meta.env.DEV) {
      setPhase('authed')
      setUsername('dev')
      return
    }

    void (async () => {
      try {
        const status = await fetchAuthStatus()
        if (status.authenticated) {
          setPhase('authed')
          setUsername('admin')
        } else if (!status.initialized) {
          setPhase('needSetup')
        } else {
          setPhase('needLogin')
        }
      } catch {
        setPhase('needLogin')
      }
    })()
  }, [setUsername])

  const renderContent = () => {
    switch (phase) {
      case 'checking':
        return (
          <main className="flex h-full items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </main>
        )
      case 'needSetup':
        return (
          <SetupPage
            onSuccess={() => {
              setPhase('authed')
              setUsername('admin')
            }}
          />
        )
      case 'needLogin':
        return (
          <LoginPage
            onSuccess={() => {
              setPhase('authed')
              setUsername('admin')
            }}
          />
        )
      case 'authed':
        return (
          <AppShell
            onSessionInvalid={() => {
              setPhase('needLogin')
              setUsername(null)
            }}
          />
        )
    }
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-card border-border text-foreground',
        }}
        theme="dark"
      />
      {renderContent()}
    </>
  )
}
