import { describe, expect, it } from 'vitest'
import { chromaticButtonDefaults, chromaticButtonProjectionScale } from '../vendor/chromatic-button/chromatic-button'
import { chromaticDefaults } from '../vendor/chromatic-button/chromatic-surface'
import { MATERIAL } from './ChromeOrb'

describe('ChromeOrb material', () => {
  it('matches the vendor button it was copied from, so the chrome looks the same', () => {
    const rim = chromaticButtonProjectionScale(chromaticButtonDefaults.projectionScale, 50)
    expect(MATERIAL.feather).toBe(chromaticButtonDefaults.feather)
    expect(MATERIAL.intensity).toBe(chromaticButtonDefaults.intensity)
    expect(MATERIAL.grain).toBe(chromaticButtonDefaults.grain)
    expect(MATERIAL.projectionScale).toBeCloseTo(rim, 9)
    expect(MATERIAL.centerProjectionScale).toBeCloseTo(
      rim - (chromaticButtonDefaults.projectionScale - chromaticDefaults.projectionScale),
      9,
    )
  })
})
