import { exec } from 'node:child_process'
import { listDevices } from './client'

export type DeviceNotReadyReason = 'offline' | 'unauthorized' | 'no_permissions' | 'not_found'

export type DeviceReadiness =
  | { ready: true }
  | { ready: false; reason: DeviceNotReadyReason; recoverable: boolean }

const POLL_MS = 500

export async function getDeviceType(serial: string): Promise<string | null> {
  const devices = await listDevices()
  const found = devices.find((d) => d.id === serial)
  return found?.type ?? null
}

export async function checkDeviceReady(serial: string): Promise<DeviceReadiness> {
  const type = await getDeviceType(serial)

  if (!type) {
    return { ready: false, reason: 'not_found', recoverable: false }
  }

  if (type === 'device') {
    return { ready: true }
  }

  if (type === 'unauthorized') {
    return { ready: false, reason: 'unauthorized', recoverable: true }
  }

  if (type === 'offline') {
    return { ready: false, reason: 'offline', recoverable: true }
  }

  if (type === 'no permissions' || type === 'no_permissions') {
    return { ready: false, reason: 'no_permissions', recoverable: false }
  }

  return { ready: false, reason: 'offline', recoverable: true }
}

export async function waitForAuthorization(serial: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const type = await getDeviceType(serial)
    if (type === 'device') return true
    if (type === null) return false
    await sleep(POLL_MS)
  }

  return false
}

export async function recoverOfflineDevice(serial: string, timeoutMs = 5_000): Promise<boolean> {
  await runAdb(['-s', serial, 'reconnect'])

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const type = await getDeviceType(serial)
    if (type === 'device') return true
    if (type === 'unauthorized') return true
    await sleep(POLL_MS)
  }

  return false
}

export function getSuggestion(reason: DeviceNotReadyReason): string {
  switch (reason) {
    case 'unauthorized':
      return '请在设备屏幕上点击「允许 USB 调试」，并勾选「始终允许」'
    case 'offline':
      return '请重新插拔 USB 数据线，或检查无线 ADB 连接后重试'
    case 'no_permissions':
      return '当前用户无权限访问该设备，请检查 ADB 权限配置'
    case 'not_found':
      return '设备未出现在 ADB 列表中，请确认已连接并刷新设备列表'
    default:
      return '请检查设备连接后重试'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runAdb(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`adb ${args.join(' ')}`, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr?.trim() || err.message))
        return
      }
      resolve((stdout || '').trim())
    })
  })
}
