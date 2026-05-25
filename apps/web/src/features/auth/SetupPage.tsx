import { type FormEvent, useState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { setup } from './authClient'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { toast } from 'sonner'

type Props = { onSuccess: () => void }

export function SetupPage({ onSuccess }: Props) {
  const [secret, setSecret] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (secret.length < 4) {
      setError('密钥至少 4 个字符')
      return
    }
    if (secret !== confirm) {
      setError('两次输入不一致')
      return
    }

    setLoading(true)
    try {
      await setup(secret)
      toast.success('初始化完成')
      onSuccess()
    } catch (e) {
      const message = e instanceof Error ? e.message : '设置失败'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex h-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center">
            <CardTitle className="text-lg">初始化系统</CardTitle>
            <CardDescription className="mt-1">
              设置一个访问密钥，后续登录时使用
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="secret">访问密钥</Label>
              <Input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="设置访问密钥"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">确认密钥</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再次输入密钥"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '完成设置'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
