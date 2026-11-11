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
 * The drop field's round upload button, in ReactDrops' chromatic chrome: flowing spectrum gradients with
 * chrome reflections (WebGL). It's only a visual — the whole drop field is the control — so it has no
 * hover state of its own. Without WebGL it falls back to a still dark chrome gradient (.chrome-orb).
 */
export function ChromeOrb() {
  return (
    <span className="chrome-orb relative isolate flex size-9 shrink-0 items-center justify-center rounded-full text-white">
      <ChromaticSurface {...MATERIAL} borderRadius={RADIUS} />
      <ArrowUp className="relative size-[18px]" strokeWidth={2} aria-hidden />
    </span>
  )
}
