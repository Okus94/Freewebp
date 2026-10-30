import { useCallback, useEffect, useRef, useState } from 'react'

/** Long enough for the download to land; short enough to still feel like a reward for it. */
export const SHAPES_DELAY_MS = 5000

/**
 * Returns whether to show the shapes, and a callback to call after every download. Five seconds after
 * the latest download the shapes appear, once per visit; downloading again within those five seconds
 * restarts the wait, so a burst of downloads leads to one moment at the end.
 */
export function useShapesAfterDownload() {
  const [showShapes, setShowShapes] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const shown = useRef(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onDownloaded = useCallback(() => {
    if (shown.current) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      shown.current = true
      setShowShapes(true)
    }, SHAPES_DELAY_MS)
  }, [])

  return { showShapes, onDownloaded }
}
