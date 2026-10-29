export type Point = { x: number; y: number }

/**
 * The outline of a rounded rectangle as a path you can sample by distance, so something can travel
 * along it at a perfectly even speed (straight edges and corners alike). Starts at the top edge,
 * just after the top-left corner, and runs clockwise.
 */
export function roundedRectPath(width: number, height: number, radius: number, inset = 0) {
  const x0 = inset
  const y0 = inset
  const x1 = width - inset
  const y1 = height - inset
  const r = Math.max(0, Math.min(radius - inset, (x1 - x0) / 2, (y1 - y0) / 2))
  const straightX = Math.max(0, x1 - x0 - 2 * r)
  const straightY = Math.max(0, y1 - y0 - 2 * r)
  const corner = (Math.PI * r) / 2

  const arc = (cx: number, cy: number, startAngle: number) => (d: number): Point => {
    const angle = startAngle + (r === 0 ? 0 : d / r)
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  // [length, point at distance d along this segment]
  const segments: [number, (d: number) => Point][] = [
    [straightX, (d) => ({ x: x0 + r + d, y: y0 })],
    [corner, arc(x1 - r, y0 + r, -Math.PI / 2)],
    [straightY, (d) => ({ x: x1, y: y0 + r + d })],
    [corner, arc(x1 - r, y1 - r, 0)],
    [straightX, (d) => ({ x: x1 - r - d, y: y1 })],
    [corner, arc(x0 + r, y1 - r, Math.PI / 2)],
    [straightY, (d) => ({ x: x0, y: y1 - r - d })],
    [corner, arc(x0 + r, y0 + r, Math.PI)],
  ]
  const perimeter = segments.reduce((sum, [length]) => sum + length, 0)

  /** The point a fraction `t` (0–1) of the way around. */
  function pointAt(t: number): Point {
    let d = (((t % 1) + 1) % 1) * perimeter
    for (const [length, at] of segments) {
      if (d <= length) return at(d)
      d -= length
    }
    return segments[0][1](0)
  }

  return { perimeter, pointAt }
}
