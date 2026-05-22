import { execSync, exec } from 'node:child_process'
import { getAdbClient } from './client'

export type AdbStatus = {
  serverAvailable: boolean
  cliAvailable: boolean
  cliPath: string | null
}

export type RootStatus = {
  rooted: boolean
  method: string | null
}

export type WirelessResult = {
  success: boolean
  message: string
}

/**
 * Check ADB availability:
 * 1. serverAvailable — test via adbkit client (TCP to ADB server)
 * 2. cliAvailable — `adb version` succeeds (required for `adb connect`)
 */
export async function checkAdbStatus(): Promise<AdbStatus> {
  let serverAvailable = false
  let cliAvailable = false
  let cliPath: string | null = null

  try {
    const client = getAdbClient()
    await client.listDevices()
    serverAvailable = true
  } catch {
    serverAvailable = false
  }

  try {
    const result = execSync('which adb', { encoding: 'utf-8', timeout: 5000 }).trim()
    if (result) {
      cliPath = result
      execSync('adb version', { encoding: 'utf-8', timeout: 5000 })
      cliAvailable = true
    }
  } catch {
    cliAvailable = false
  }

  return { serverAvailable, cliAvailable, cliPath }
}

/**
 * Connect to a wireless ADB device: `adb connect host:port`
 */
export function connectWireless(host: string, port: number): Promise<WirelessResult> {
  return new Promise((resolve) => {
    const address = `${host}:${port}`
    exec(`adb connect ${address}`, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, message: stderr?.trim() || err.message })
        return
      }
      const output = (stdout || '').trim()
      const ok = output.includes('connected') && !output.includes('cannot')
      resolve({ success: ok, message: output })
    })
  })
}

/**
 * Check if a device is rooted by running `su -c id` via adb shell.
 */
export function checkRootStatus(serial: string): Promise<RootStatus> {
  return new Promise((resolve) => {
    exec(
      `adb -s ${serial} shell su -c id`,
      { timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve({ rooted: false, method: null })
          return
        }
        const output = stdout.trim()
        if (output.includes('uid=0')) {
          const method = output.includes('magisk') ? 'magisk' : 'su'
          resolve({ rooted: true, method })
        } else {
          resolve({ rooted: false, method: null })
        }
      },
    )
  })
}

/**
 * Disconnect a wireless ADB device: `adb disconnect address`
 */
export function disconnectWireless(address: string): Promise<WirelessResult> {
  return new Promise((resolve) => {
    exec(`adb disconnect ${address}`, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, message: stderr?.trim() || err.message })
        return
      }
      resolve({ success: true, message: (stdout || '').trim() })
    })
  })
}
