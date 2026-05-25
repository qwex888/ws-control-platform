import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

type AuthData = {
  secret: string
  createdAt: string
}

const DATA_DIR = path.resolve(process.cwd(), 'data')
const AUTH_FILE = path.join(DATA_DIR, 'auth.json')

let cached: AuthData | null | undefined = undefined

function readFromFile(): AuthData | null {
  try {
    if (!existsSync(AUTH_FILE)) return null
    const raw = readFileSync(AUTH_FILE, 'utf-8')
    const data = JSON.parse(raw) as AuthData
    if (data.secret && typeof data.secret === 'string') return data
    return null
  } catch {
    return null
  }
}

export function hasSecret(): boolean {
  if (process.env.JWT_SECRET) return true
  if (cached === undefined) cached = readFromFile()
  return cached !== null
}

export function getSecret(): string | null {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (cached === undefined) cached = readFromFile()
  return cached?.secret ?? null
}

export function saveSecret(secret: string): void {
  mkdirSync(DATA_DIR, { recursive: true })
  const data: AuthData = { secret, createdAt: new Date().toISOString() }
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8')
  cached = data
}
