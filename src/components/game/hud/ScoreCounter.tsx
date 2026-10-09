import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { COMBO_RULES } from '@/game/config'
import { cn } from '@/lib/utils'
import { duration, spring } from '@/theme/motion'
import { formatScore } from './format'

export interface ScoreCounterProps {
  score: number
  /** Combo en cours : la pastille « ×2 » s'affiche à côté du score. */
  comboActive: boolean
  /**
   * Note de triade dont l'anneau tourne : une bonne réponse vaut double, la
   * pastille s'affiche en vert acide (le combo est alors toujours éteint).
   */
  triadBoost?: boolean
  className?: string
}

/** Compteur incrémenté à chaque hausse du score : rejoue le « pop » du chiffre. */
function useScorePulse(score: number): number {
  const [tracked, setTracked] = useState({ score, pulse: 0 })
  if (score !== tracked.score) {
    setTracked({ score, pulse: score > tracked.score ? tracked.pulse + 1 : tracked.pulse })
  }
  return tracked.pulse
}

/** Score de la partie, et pastille du multiplicateur pendant un combo ou l'anneau d'une triade. */
export function ScoreCounter({
  score,
  comboActive,
  triadBoost = false,
  className,
}: ScoreCounterProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const pulse = useScorePulse(score)
  const boost = comboActive ? 'combo' : triadBoost ? 'triad' : null

  return (
    <span
      data-slot="level-score"
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums', className)}
    >
      <span className="sr-only">Score :</span>
      <motion.span
        key={pulse}
        data-slot="level-score-value"
        className="inline-block font-medium"
        initial={pulse > 0 && !reduceMotion ? { scale: 1.25 } : false}
        animate={{ scale: 1 }}
        transition={spring.bouncy}
      >
        {formatScore(score)}
      </motion.span>
      <span data-slot="level-score-unit" className="text-xs text-muted-foreground">
        pts
      </span>
      <AnimatePresence>
        {boost && (
          <motion.span
            key={boost}
            data-slot="level-score-multiplier"
            data-boost={boost}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[0.7rem] leading-none font-bold',
              boost === 'combo'
                ? 'bg-combo text-combo-foreground shadow-[0_0_12px_var(--combo-glow)]'
                : 'bg-triad text-triad-foreground shadow-[0_0_12px_var(--triad-glow)]',
            )}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
            transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
          >
            ×{COMBO_RULES.multiplier}
            <span className="sr-only">
              {boost === 'combo'
                ? ' : combo actif, points doublés'
                : ' : note de triade, points doublés avant la fin du délai'}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
