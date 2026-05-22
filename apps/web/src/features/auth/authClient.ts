export type LoginPayload = { username: string; password: string }

export const fetchMe = async (): Promise<{ username: string } | null> => {
  const response = await fetch('/api/me', { credentials: 'include' })
  if (!response.ok) return null
  const body = (await response.json()) as { data: { username: string } | null }
  return body.data
}

export const login = async (payload: LoginPayload): Promise<{ username: string }> => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('登录失败，请检查账号密码')
  }

  const body = (await response.json()) as { data: { username: string } }
  return body.data
}
