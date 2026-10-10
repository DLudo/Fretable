import { useCallback } from 'react'
import { useAnimate, useReducedMotion, type Transition } from 'motion/react'

import { duration, ease } from '@/theme/motion'

/** Petit coup sec du manche sur une bonne réponse. */
const BOARD_HIT: Transition = { duration: duration.fast, ease: ease.outQuart }
/** Secousse latérale sur une erreur. */
const BOARD_SHAKE: Transition = { duration: duration.base, ease: ease.outQuart }

/**
 * Impact physique du manche : petit coup sec sur une bonne réponse, secousse
 * sur une erreur. `ref` va sur le conteneur du manche ; `impact` se déclenche
 * à chaque tentative (niveau comme boss final). Rien en animations réduites.
 */
export function useBoardImpact() {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduced = useReducedMotion()
  const impact = useCallback(
    (correct: boolean) => {
      if (reduced || !scope.current) return
      if (correct) animate(scope.current, { y: [0, 3, 0] }, BOARD_HIT)
      else animate(scope.current, { x: [0, -7, 6, -4, 3, -1, 0] }, BOARD_SHAKE)
    },
    [animate, scope, reduced],
  )
  return { ref: scope, impact }
}
