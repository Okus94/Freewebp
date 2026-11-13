import { useSyncExternalStore } from 'react'

/** Whether a CSS media query matches right now; re-renders when that changes (a window resized, a tablet's keyboard attached). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
