import { lazy, Suspense, useState } from 'react'

// Loaded only when it's time to show, so the physics engine isn't part of the first page load.
const ShapePhysics = lazy(() =>
  import('../vendor/shape-physics/shape-physics').then((module) => ({ default: module.ShapePhysics })),
)

/** The softened spectrum from index.css (the drop field's light), as plain colours for the canvas. */
const SPECTRUM = ['#ff8a8a', '#ffb86b', '#ffe27a', '#8ee0a1', '#7fb8ff', '#b79bff']

/** Small and few enough that the pile stays a low strip along the bottom edge. `size` is a radius in px. */
const DESKTOP = { size: 26, count: 18 }
const PHONE = { size: 18, count: 12 }

/**
 * Playful 3D shapes that tumble down behind the page and pile up along the bottom of the screen.
 * Purely decorative: fixed behind the content and click-through, so nothing on the page is blocked.
 * With reduced motion on, the component shows the pile already settled instead of falling.
 */
export function ShapeRain() {
  const [scale] = useState(() => (window.matchMedia('(max-width: 639px)').matches ? PHONE : DESKTOP))
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" data-testid="shape-rain">
      <Suspense fallback={null}>
        <ShapePhysics
          height="100%"
          size={scale.size}
          count={scale.count}
          background="transparent"
          colors={SPECTRUM}
          interactive={false}
          followCursor={false}
          aria-label="Decorative shapes"
        />
      </Suspense>
    </div>
  )
}
