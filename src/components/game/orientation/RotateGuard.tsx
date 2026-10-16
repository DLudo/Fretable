import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MoveHorizontal, Smartphone } from 'lucide-react'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { COARSE_POINTER_QUERY } from '@/lib/landscape'
import { usePortraitBlocked } from './useAutoSuspend'

/** Un tour de l'icône : le téléphone se couche, marque un temps, se relève. */
const TURN = { duration: 2.4, times: [0, 0.35, 0.75, 1], repeat: Infinity, repeatDelay: 0.4 }

/**
 * Le jeu se joue à l'horizontale, comme sur ordinateur. Écran en portrait
 * (`PORTRAIT_QUERY`) : un écran plein l'invite à tourner l'appareil, et tout
 * le reste devient inerte ; la partie en cours, elle, se suspend (voir
 * `useAutoSuspend`). Sur un ordinateur, une fenêtre trop étroite invite à
 * l'élargir.
 */
export function RotateGuard({ children }: { children: ReactNode }): ReactNode {
  const blocked = usePortraitBlocked()
  return (
    <>
      <div data-slot="rotate-guard-content" className="contents" inert={blocked}>
        {children}
      </div>
      {blocked && <RotatePrompt />}
    </>
  )
}

function RotatePrompt() {
  const id = useId()
  const touch = useMediaQuery(COARSE_POINTER_QUERY)
  const reduceMotion = useReducedMotion()
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      data-slot="rotate-prompt"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center"
    >
      {touch ? (
        <motion.span
          aria-hidden
          className="text-foreground"
          animate={reduceMotion ? undefined : { rotate: [0, -90, -90, 0] }}
          transition={reduceMotion ? undefined : TURN}
        >
          <Smartphone className="size-14" strokeWidth={1.5} />
        </motion.span>
      ) : (
        <MoveHorizontal aria-hidden className="size-14 text-foreground" strokeWidth={1.5} />
      )}
      <div className="flex max-w-xs flex-col gap-2">
        <h1 id={`${id}-title`} className="text-xl font-semibold">
          {touch ? 'Tourne ton téléphone' : 'Élargis la fenêtre'}
        </h1>
        <p id={`${id}-description`} className="text-sm text-muted-foreground">
          {touch
            ? 'Fretable se joue à l’horizontale, le manche en travers de l’écran, comme une guitare entre les mains.'
            : 'Fretable se joue en largeur, le manche en travers de l’écran.'}
        </p>
      </div>
      {touch && (
        <p className="max-w-xs text-xs text-muted-foreground">
          L’écran ne pivote pas ? Désactive le verrouillage de la rotation.
        </p>
      )}
    </div>
  )
}
