import { useEffect, useState } from 'react'

import { totalDurationMs } from './selectors'
import type { GameState } from './types'

export type CountdownState = Pick<
  GameState,
  'phase' | 'startedAt' | 'endedAt' | 'level' | 'bonusTimeMs'
>

/**
 * Temps restant (ms) à l'instant `now` — calcul pur.
 * Plein avant le départ, figé à la fin de la partie, borné à [0, durée].
 * La durée inclut le temps accordé en cours de partie (`bonusTimeMs`).
 */
export function remainingMs(state: CountdownState, now: number): number {
  const { phase, startedAt, endedAt } = state
  const duration = totalDurationMs(state)
  if (startedAt === null) return duration
  const end = endedAt ?? (phase === 'playing' ? Math.max(now, startedAt) : startedAt)
  return Math.min(duration, Math.max(0, duration - (end - startedAt)))
}

/**
 * Temps restant (ms), rafraîchi à chaque frame pendant la partie.
 * À n'utiliser que dans le composant qui l'affiche : seul lui se re-rend à 60 i/s.
 */
export function useCountdown(state: CountdownState): number {
  const { phase } = state
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (phase !== 'playing') return
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [phase])

  return remainingMs(state, now)
}
