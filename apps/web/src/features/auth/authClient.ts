export type AuthStatus = {
  initialized: boolean
  authenticated: boolean
}

export const fetchAuthStatus = async (): Promise<AuthStatus> => {
  const response = await fetch('/auth/status', { credentials: 'include' })
  if (!response.ok) throw new Error('无法获取认证状态')
  const body = (await response.json()) as { data: AuthStatus }
  return body.data
}

export const fetchMe = async (): Promise<{ username: string } | null> => {
  const response = await fetch('/api/me', { credentials: 'include' })
  if (!response.ok) return null
  const body = (await response.json()) as { data: { username: string } | null }
  return body.data
}

export const login = async (secret: string): Promise<void> => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (body?.error === 'INVALID_SECRET') throw new Error('密钥错误')
    throw new Error('登录失败')
  }
}

export const setup = async (secret: string): Promise<void> => {
  const response = await fetch('/auth/setup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (body?.error === 'ALREADY_INITIALIZED') throw new Error('系统已初始化')
    if (body?.error === 'SECRET_TOO_SHORT') throw new Error('密钥至少 4 个字符')
    throw new Error('初始化失败')
  }
}

export const logout = async (): Promise<void> => {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}
