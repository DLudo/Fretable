import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'

import { GAME_FEEL } from '@/game/config'
import { countdownDigit } from '@/game/engine/selectors'
import type { GameState } from '@/game/engine/types'
import { cn } from '@/lib/utils'
import { duration, ease, spring } from '@/theme/motion'

export interface StartCountdownProps {
  state: Pick<GameState, 'phase' | 'startingAt'>
  className?: string
}

/** Chaque chiffre s'efface vite : le suivant arrive déjà. */
const DIGIT_EXIT: Transition = { duration: duration.fast, ease: ease.inQuad }
/** Onde qui part du chiffre à chaque battement. */
const RING_TRANSITION: Transition = { duration: 0.8, ease: ease.outExpo }

/**
 * Décompte 3, 2, 1 avant la première note, en grand sur le manche.
 * Le parent doit être `relative` ; rien ne capte les clics. Chaque chiffre
 * surgit avec une onde ; à la fin du « 1 », la première note apparaît.
 */
export function StartCountdown({ state, className }: StartCountdownProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const [now, setNow] = useState(() => performance.now())
  const digit = countdownDigit(state, now)
  const { phase, startingAt } = state

  // Un rendu par chiffre : réveil juste après chaque changement de seconde du décompte.
  useEffect(() => {
    if (phase !== 'starting' || startingAt === null) return
    const step = GAME_FEEL.startCountdownStepMs
    const elapsed = Math.max(0, performance.now() - startingAt)
    const timer = window.setTimeout(() => setNow(performance.now()), step - (elapsed % step) + 1)
    return () => window.clearTimeout(timer)
  }, [phase, startingAt, now])

  return (
    <div
      data-slot="start-countdown"
      data-digit={digit ?? undefined}
      className={cn('pointer-events-none absolute inset-0 z-10 grid place-items-center', className)}
    >
      <span aria-live="assertive" aria-atomic className="sr-only">
        {digit ?? ''}
      </span>
      <AnimatePresence>
        {digit !== null && (
          <motion.span
            key={`${startingAt}:${digit}`}
            aria-hidden
            data-slot="start-countdown-digit"
            className="relative col-start-1 row-start-1 grid place-items-center"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7, transition: DIGIT_EXIT }
            }
            transition={reduceMotion ? { duration: duration.fast } : spring.pop}
          >
            {!reduceMotion && (
              <motion.span
                data-slot="start-countdown-ring"
                className="absolute size-[1.15em] rounded-full border-2 border-foreground/50 text-[clamp(4rem,16vmin,10rem)]"
                initial={{ opacity: 0.9, scale: 0.55 }}
                animate={{ opacity: 0, scale: 1.5 }}
                transition={RING_TRANSITION}
              />
            )}
            <span className="text-[clamp(4rem,16vmin,10rem)] leading-none font-semibold tabular-nums text-foreground [text-shadow:0_0_24px_var(--background),0_0_56px_var(--background)]">
              {digit}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
