import { ArrowUp } from 'lucide-react'
import { chromaticButtonDefaults, chromaticButtonProjectionScale } from '../vendor/chromatic-button/chromatic-button'
import { ChromaticSurface, chromaticDefaults } from '../vendor/chromatic-button/chromatic-surface'

/** Fully round, so the chrome's reflections wrap the circle the way they wrap the button's ends. */
const RADIUS = 50
const RIM_PROJECTION = chromaticButtonProjectionScale(chromaticButtonDefaults.projectionScale, RADIUS)

/**
 * The drop field's round upload button, in ReactDrops' chromatic chrome: flowing spectrum gradients with
 * chrome reflections (WebGL). It's only a visual — the whole drop field is the control — so it has no
 * hover state of its own. Without WebGL it falls back to a still dark chrome gradient (.chrome-orb).
 */
export function ChromeOrb() {
  return (
    <span className="chrome-orb relative isolate flex size-9 shrink-0 items-center justify-center rounded-full text-white">
      <ChromaticSurface
        feather={chromaticButtonDefaults.feather}
        intensity={chromaticButtonDefaults.intensity}
        grain={chromaticButtonDefaults.grain}
        borderRadius={RADIUS}
        projectionScale={RIM_PROJECTION}
        // As in the vendor button: the face keeps the material's own projection; only the rim is wider.
        centerProjectionScale={RIM_PROJECTION - (chromaticButtonDefaults.projectionScale - chromaticDefaults.projectionScale)}
      />
      <ArrowUp className="relative size-[18px]" strokeWidth={2} aria-hidden />
    </span>
  )
}
