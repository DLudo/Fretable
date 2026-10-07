import { useEffect, useState } from 'react'

import type { GameState } from './types'

/**
 * Temps restant (ms), rafraîchi à chaque frame pendant la partie.
 * À n'utiliser que dans le composant qui l'affiche : seul lui se re-rend à 60 i/s.
 */
export function useCountdown(
  state: Pick<GameState, 'phase' | 'startedAt' | 'endedAt' | 'level'>,
): number {
  const { phase, startedAt, endedAt } = state
  const duration = state.level.durationMs
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (phase !== 'playing') return
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [phase])

  if (startedAt === null) return duration
  const end = endedAt ?? (phase === 'playing' ? Math.max(now, startedAt) : startedAt)
  return Math.min(duration, Math.max(0, duration - (end - startedAt)))
}
