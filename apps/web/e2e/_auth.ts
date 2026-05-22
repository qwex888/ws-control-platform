import { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readEnv = () => {
  const path = resolve(process.cwd(), '../../.env.development')
  const raw = readFileSync(path, 'utf-8')
  const map = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const idx = line.indexOf('=')
      if (idx > 0) {
        acc[line.slice(0, idx)] = line.slice(idx + 1)
      }
      return acc
    }, {})

  return {
    username: map.AUTH_USERNAME ?? 'admin',
    password: map.AUTH_PASSWORD ?? 'admin123',
  }
}

export const loginIfNeeded = async (page: Page) => {
  await page.goto('/')
  const loginVisible = await page.getByRole('main', { name: 'Login page' }).isVisible().catch(() => false)
  if (!loginVisible) return

  const { username, password } = readEnv()
  await page.getByLabel('用户名').fill(username)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
}
