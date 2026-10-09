import { useCallback, useSyncExternalStore } from 'react'

const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Suit une media query CSS (`matchMedia`) et se met à jour à chaque changement.
 * Hors navigateur (rendu serveur), renvoie `fallback`.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = () => (hasMatchMedia() ? window.matchMedia(query).matches : fallback)
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback)
}
