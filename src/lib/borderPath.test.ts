import { describe, expect, it } from 'vitest'
import { roundedRectPath } from './borderPath'

describe('roundedRectPath', () => {
  const W = 640
  const H = 120
  const R = 18
  const path = roundedRectPath(W, H, R)

  it('measures the perimeter of a rounded rectangle', () => {
    const expected = 2 * (W - 2 * R) + 2 * (H - 2 * R) + 2 * Math.PI * R
    expect(path.perimeter).toBeCloseTo(expected, 6)
  })

  it('starts on the top edge after the corner and loops back to the start', () => {
    expect(path.pointAt(0)).toEqual({ x: R, y: 0 })
    const end = path.pointAt(1)
    expect(end.x).toBeCloseTo(R, 6)
    expect(end.y).toBeCloseTo(0, 6)
  })

  it('stays exactly on the outline all the way round', () => {
    for (let i = 0; i < 400; i++) {
      const { x, y } = path.pointAt(i / 400)
      const onStraight = (Math.abs(y) < 1e-6 || Math.abs(y - H) < 1e-6 || Math.abs(x) < 1e-6 || Math.abs(x - W) < 1e-6)
      const cx = x < R ? R : x > W - R ? W - R : x
      const cy = y < R ? R : y > H - R ? H - R : y
      const onCorner = Math.abs(Math.hypot(x - cx, y - cy) - R) < 1e-6
      expect(onStraight || onCorner, `point ${i} (${x.toFixed(2)}, ${y.toFixed(2)})`).toBe(true)
    }
  })

  it('moves at an even speed, corners included', () => {
    const steps = 500
    const gaps: number[] = []
    for (let i = 0; i < steps; i++) {
      const a = path.pointAt(i / steps)
      const b = path.pointAt((i + 1) / steps)
      gaps.push(Math.hypot(b.x - a.x, b.y - a.y))
    }
    const step = path.perimeter / steps
    // Straight steps are exactly `step`; steps across a curve are a chord, a hair shorter.
    for (const gap of gaps) expect(gap).toBeGreaterThan(step * 0.99)
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(step + 1e-6)
  })

  it('gives the direction of travel, turning a quarter at each corner', () => {
    const at = (d: number) => path.headingAt(d / path.perimeter)
    const straightX = W - 2 * R
    const straightY = H - 2 * R
    const corner = (Math.PI * R) / 2
    expect(at(10)).toBe(0) // along the top, moving right
    expect(at(straightX + corner / 2)).toBeCloseTo(45, 6) // halfway round the top-right corner
    expect(at(straightX + corner + 10)).toBe(90) // down the right side
    expect(at(straightX + straightY + 2 * corner + 10)).toBe(180) // back along the bottom
    expect(path.headingAt(0)).toBe(0)
    expect(path.headingAt(1)).toBe(360)
  })

  it('turns smoothly and only forwards, so the shape never spins back', () => {
    let previous = path.headingAt(0)
    for (let i = 1; i <= 1000; i++) {
      const heading = path.headingAt(i / 1000)
      expect(heading).toBeGreaterThanOrEqual(previous)
      expect(heading - previous, `step ${i}`).toBeLessThan(5)
      previous = heading
    }
  })

  it('insets the path, e.g. to the centre of a stroke', () => {
    const inset = roundedRectPath(W, H, R, 0.75)
    expect(inset.pointAt(0)).toEqual({ x: R, y: 0.75 })
  })
})
