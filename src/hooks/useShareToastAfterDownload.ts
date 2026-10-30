import { useCallback, useEffect, useRef } from 'react'
import { showShareToast } from '../components/ShareToast'

/** Long enough for the download to land and the visitor to glance at it; short enough to still feel related. */
export const SHARE_TOAST_DELAY_MS = 5000

/**
 * Returns a callback to call after every download. Five seconds after the latest one, the share toast
 * appears, once per visit. Downloading again within those five seconds restarts the wait, so a burst of
 * downloads leads to one toast at the end.
 */
export function useShareToastAfterDownload() {
  const timer = useRef<number | undefined>(undefined)
  const shown = useRef(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return useCallback(() => {
    if (shown.current) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      shown.current = true
      showShareToast()
    }, SHARE_TOAST_DELAY_MS)
  }, [])
}
