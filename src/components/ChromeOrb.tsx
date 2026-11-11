import { ArrowUp } from 'lucide-react'
import { ChromaticSurface, chromaticDefaults } from '../vendor/chromatic-button/chromatic-surface'

/** Fully round, so the chrome's reflections wrap the circle the way they wrap the button's ends. */
const RADIUS = 50

/**
 * The vendor button's material (`chromaticButtonDefaults` in chromatic-button.tsx), copied rather than
 * imported so the unused button component and its styles stay out of the bundle. At a 50% radius the
 * button keeps its rim projection as is, and the face uses the material's own projection.
 */
export const MATERIAL = {
  feather: 100,
  intensity: 1.4,
  grain: 0.105,
  projectionScale: 174.7,
  centerProjectionScale: chromaticDefaults.projectionScale,
}

/**
 * ReactDrops' chromatic chrome (flowing spectrum gradients with chrome reflections, drawn with WebGL) as a
 * fill for any fully rounded control. Put it first inside an element with the `chrome` class, which sizes
 * it to fill and shows a still dark chrome gradient until WebGL paints, or if WebGL isn't available.
 */
export function ChromeFill() {
  return <ChromaticSurface {...MATERIAL} borderRadius={RADIUS} />
}

/**
 * The drop field's round upload button, in chrome. It's only a visual — the whole drop field is the
 * control — so it has no hover state of its own.
 */
export function ChromeOrb() {
  return (
    <span className="chrome relative isolate flex size-9 shrink-0 items-center justify-center rounded-full text-white">
      <ChromeFill />
      <ArrowUp className="relative size-[18px]" strokeWidth={2} aria-hidden />
    </span>
  )
}
