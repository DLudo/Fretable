import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MoveHorizontal, Smartphone } from 'lucide-react'

import { isPhone, useTouchDevice } from '@/lib/touch'
import { usePortraitBlocked } from './useAutoSuspend'

/** Un tour de l'icône : le téléphone se couche, marque un temps, se relève. */
const TURN = { duration: 2.4, times: [0, 0.35, 0.75, 1], repeat: Infinity, repeatDelay: 0.4 }

/**
 * Le jeu se joue à l'horizontale, comme sur ordinateur. Écran en portrait
 * (`PORTRAIT_QUERY`) : un écran plein invite à tourner le téléphone, et tout
 * le reste devient inerte ; la partie en cours, elle, se suspend (voir
 * `useAutoSuspend`). Là où tourner l'appareil n'y changerait rien (fenêtre
 * étroite d'un ordinateur, d'une tablette en écran partagé), il invite à
 * élargir la fenêtre.
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

/** Les trois messages : tourner le téléphone, élargir une fenêtre au doigt ou à la souris. */
const MESSAGES = {
  phone: {
    title: 'Tourne ton téléphone',
    body: 'Fretable se joue à l’horizontale, le manche en travers de l’écran, comme une guitare entre les mains.',
    hint: 'L’écran ne pivote pas ? Désactive le verrouillage de la rotation.',
  },
  tablet: {
    title: 'Agrandis la fenêtre',
    body: 'Fretable se joue en largeur, le manche en travers de l’écran.',
    hint: 'Quitte l’écran partagé ou Slide Over, ou élargis sa fenêtre.',
  },
  desktop: {
    title: 'Élargis la fenêtre',
    body: 'Fretable se joue en largeur, le manche en travers de l’écran.',
    hint: null,
  },
} as const

function RotatePrompt() {
  const id = useId()
  const touch = useTouchDevice()
  const kind = touch ? (isPhone() ? 'phone' : 'tablet') : 'desktop'
  const message = MESSAGES[kind]
  const reduceMotion = useReducedMotion()
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      data-slot="rotate-prompt"
      data-kind={kind}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center"
    >
      {kind === 'phone' ? (
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
          {message.title}
        </h1>
        <p id={`${id}-description`} className="text-sm text-muted-foreground">
          {message.body}
        </p>
      </div>
      {message.hint && <p className="max-w-xs text-xs text-muted-foreground">{message.hint}</p>}
    </div>
  )
}
