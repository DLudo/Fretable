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
 * L'échéance se compte depuis `challengeShownAt`, l'horloge du moteur
 * (`performance.now()`), et non depuis le rendu : pastille et barème
 * basculent au même instant.
 */
export function useTriadRing(
  state: Pick<GameState, 'phase' | 'locked' | 'challenge' | 'challengeShownAt' | 'triad'>,
): boolean {
  const { phase, locked, challenge, challengeShownAt, triad } = state
  const id =
    phase === 'playing' && !locked && challenge?.triad === true && triad !== null
      ? challenge.id
      : null
  const [spentId, setSpentId] = useState<number | null>(null)

  useEffect(() => {
    if (id === null || challengeShownAt === null) return
    const delay = challengeShownAt + TRIAD_RULES.fastReactionMs - performance.now()
    const timer = window.setTimeout(() => setSpentId(id), Math.max(0, delay))
    return () => window.clearTimeout(timer)
  }, [id, challengeShownAt])

  return id !== null && spentId !== id
}
