import type { MouseEvent } from 'react'
import type { Transition } from 'motion/react'

import { duration, ease } from '@/theme/motion'

/* Constantes et utilitaires des écrans d'avant et d'après partie (hors composants). */

export const ENTER: Transition = { duration: 0.25, ease: ease.outExpo }
export const LEAVE: Transition = { duration: duration.fast, ease: ease.inQuad }

/**
 * Action de bouton qui rend d'abord le focus : la touche suivante revient aux
 * contrôles clavier du jeu au lieu de réactiver ce bouton (voir `PresenceLayer`).
 */
export function blurThen(action: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
    action()
  }
}
