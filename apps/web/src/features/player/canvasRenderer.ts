/**
 * FLAG_SECURE produces frames where every pixel is pure black (0,0,0).
 * Dark-mode UIs also have dark backgrounds but always contain visible
 * elements (text, icons, status bar) with non-zero brightness.
 *
 * Detection strategy: sample a uniform grid and check the BRIGHTEST
 * sample. If even one sample exceeds the threshold, the frame is not
 * a secure black screen. This avoids false positives on dark-mode UIs.
 */
const BLACK_PIXEL_BRIGHTNESS_LIMIT = 30
const BLACK_FRAME_STREAK_REQUIRED = 15
const GRID_COLS = 6
const GRID_ROWS = 10

const DEBOUNCE_MS = 300

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private blackStreak = 0
  private _secureScreen = false
  private onSecureScreenChange: ((secure: boolean) => void) | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  get secureScreen() {
    return this._secureScreen
  }

  setSecureScreenListener(listener: ((secure: boolean) => void) | null) {
    this.onSecureScreenChange = listener
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  detach() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.canvas = null
    this.ctx = null
  }

  drawFrame(frame: VideoFrame) {
    if (!this.canvas || !this.ctx) {
      frame.close()
      return
    }

    if (this.canvas.width !== frame.displayWidth || this.canvas.height !== frame.displayHeight) {
      this.canvas.width = frame.displayWidth
      this.canvas.height = frame.displayHeight
    }

    this.ctx.drawImage(frame, 0, 0)

    if (this.isBlackFrame(frame.displayWidth, frame.displayHeight)) {
      this.blackStreak++
    } else {
      this.blackStreak = 0
    }

    const nowSecure = this.blackStreak >= BLACK_FRAME_STREAK_REQUIRED
    if (nowSecure !== this._secureScreen) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)

      if (nowSecure) {
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null
          if (this.blackStreak >= BLACK_FRAME_STREAK_REQUIRED && !this._secureScreen) {
            this._secureScreen = true
            this.onSecureScreenChange?.(true)
          }
        }, DEBOUNCE_MS)
      } else {
        this._secureScreen = false
        this.onSecureScreenChange?.(false)
      }
    }

    frame.close()
  }

  clear() {
    if (!this.canvas || !this.ctx) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * A true FLAG_SECURE frame is pure black — all pixels ≈ (0,0,0).
   * Sample a 6x10 grid (60 points) and check the MAX brightness.
   * If any single sample exceeds the limit, the frame is NOT black.
   */
  private isBlackFrame(width: number, height: number): boolean {
    if (!this.ctx || width === 0 || height === 0) return false

    const cellW = width / GRID_COLS
    const cellH = height / GRID_ROWS

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = Math.floor(cellW * (col + 0.5))
        const y = Math.floor(cellH * (row + 0.5))
        const pixel = this.ctx.getImageData(x, y, 1, 1).data
        const brightness = pixel[0]! + pixel[1]! + pixel[2]!
        if (brightness > BLACK_PIXEL_BRIGHTNESS_LIMIT) {
          return false
        }
      }
    }
    return true
  }
}
