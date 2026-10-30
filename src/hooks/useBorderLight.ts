import { useEffect, useRef, type RefObject } from 'react'
import { roundedRectPath } from '../lib/borderPath'

const LAP_MS = 10_000
/** Fraction of the way round where the light rests when reduced motion is on: the top edge. */
const PARKED_AT = 0.12
/** One keyframe every few pixels keeps the corners round. */
const PX_PER_KEYFRAME = 4

/**
 * Moves the light around the border of `ring` at an even speed, one lap every 10s, turning it to face
 * the way it's going so its tail always trails behind.
 *
 * It animates only `transform` through the Web Animations API, which the browser can run on the
 * compositor (the GPU), so the light glides at full frame rate even while the page is busy decoding
 * an image. The path is measured from the ring's real size and rebuilt when it resizes, keeping its
 * place in the lap. `rate` changes speed smoothly from wherever the light is.
 */
export function useBorderLight(
  ring: RefObject<HTMLElement | null>,
  bulb: RefObject<HTMLElement | null>,
  rate: number,
) {
  const animation = useRef<Animation | null>(null)
  const currentRate = useRef(rate)

  useEffect(() => {
    const ringEl = ring.current
    const bulbEl = bulb.current
    if (!ringEl || !bulbEl) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const build = () => {
      // offsetWidth/Height ignore the field's own scale, so the path always matches the real border.
      const width = ringEl.offsetWidth
      const height = ringEl.offsetHeight
      const radius = parseFloat(getComputedStyle(ringEl).borderTopLeftRadius) || 0
      const halfWidth = bulbEl.offsetWidth / 2
      const halfHeight = bulbEl.offsetHeight / 2
      const path = roundedRectPath(width, height, radius, 0.75) // centre of the 1.5px stroke
      // Centre the light on the stroke, then turn it about that centre to the direction of travel.
      const at = (t: number) => {
        const p = path.pointAt(t)
        return `translate3d(${p.x - halfWidth}px, ${p.y - halfHeight}px, 0) rotate(${path.headingAt(t)}deg)`
      }

      const previous = animation.current
      const progress = previous ? (Number(previous.currentTime ?? 0) % LAP_MS) / LAP_MS : 0
      previous?.cancel()
      animation.current = null

      if (reduceMotion.matches) {
        bulbEl.style.transform = at(PARKED_AT)
        return
      }
      bulbEl.style.transform = ''
      const count = Math.max(16, Math.ceil(path.perimeter / PX_PER_KEYFRAME))
      const keyframes = Array.from({ length: count + 1 }, (_, i) => ({ transform: at(i / count) }))
      const next = bulbEl.animate(keyframes, { duration: LAP_MS, iterations: Infinity, easing: 'linear' })
      next.id = 'border-light'
      next.currentTime = progress * LAP_MS
      next.playbackRate = currentRate.current
      animation.current = next
    }

    build()
    const resize = new ResizeObserver(build)
    resize.observe(ringEl)
    reduceMotion.addEventListener('change', build)
    return () => {
      resize.disconnect()
      reduceMotion.removeEventListener('change', build)
      animation.current?.cancel()
      animation.current = null
    }
  }, [ring, bulb])

  useEffect(() => {
    currentRate.current = rate
    animation.current?.updatePlaybackRate(rate)
  }, [rate])
}
