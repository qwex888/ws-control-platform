import { describe, expect, it } from 'vitest'
import { calcFitRect } from '../fitRect'

describe('fitRect', () => {
  it('fits landscape frame inside container without stretch', () => {
    const result = calcFitRect({
      containerW: 1000,
      containerH: 600,
      frameW: 1920,
      frameH: 1080,
    })

    expect(result.scale).toBeCloseTo(0.5208333, 4)
    expect(result.width).toBe(1000)
    expect(result.height).toBe(563)
  })

  it('fits portrait frame inside container without stretch', () => {
    const result = calcFitRect({
      containerW: 1000,
      containerH: 600,
      frameW: 1080,
      frameH: 1920,
    })

    expect(result.scale).toBeCloseTo(0.3125, 4)
    expect(result.width).toBe(338)
    expect(result.height).toBe(600)
  })
})
