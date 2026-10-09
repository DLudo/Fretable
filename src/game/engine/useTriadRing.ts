import { useEffect, useState } from 'react'

import { TRIAD_RULES } from '@/game/config'
import type { GameState } from './types'

/**
 * L'anneau de la note de triade en cours tourne-t-il encore ? Vrai dès qu'une
 * note de triade attend sa réponse, faux une fois son délai écoulé
 * (`TRIAD_RULES.fastReactionMs`) ou la réponse donnée : une bonne réponse,
 * d'ici là, vaut double (voir `triadMultiplier`).
 *
 * L'anneau du manche et la pastille « ×2 » du score en dépendent ensemble.
 */
export function useTriadRing(
  state: Pick<GameState, 'phase' | 'locked' | 'challenge' | 'triad'>,
): boolean {
  const { phase, locked, challenge, triad } = state
  const id =
    phase === 'playing' && !locked && challenge?.triad === true && triad !== null
      ? challenge.id
      : null
  const [spentId, setSpentId] = useState<number | null>(null)

  useEffect(() => {
    if (id === null) return
    const timer = window.setTimeout(() => setSpentId(id), TRIAD_RULES.fastReactionMs)
    return () => window.clearTimeout(timer)
  }, [id])

  return id !== null && spentId !== id
}
