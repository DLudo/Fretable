import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { COMBO_RULES } from '@/game/config'
import { cn } from '@/lib/utils'
import { duration, spring } from '@/theme/motion'
import { formatScore } from './format'

export interface ScoreCounterProps {
  score: number
  /** Combo en cours : la pastille du multiplicateur (« ×2 ») s'affiche à côté du score. */
  comboActive: boolean
  /**
   * Note de triade dont l'anneau tourne : une bonne réponse vaut double, la
   * pastille s'affiche en vert acide (le combo est alors toujours éteint).
   */
  triadBoost?: boolean
  /** Combo enflammé (boss final) : la pastille passe à l'orangé de flamme. */
  comboFire?: boolean
  /** Multiplicateur affiché pendant le combo (par défaut celui du combo classique). */
  multiplier?: number
  className?: string
}

/** Lecture du multiplicateur pour les lecteurs d'écran. */
const MULTIPLIED: Record<number, string> = { 2: 'doublés', 3: 'triplés' }
const multipliedText = (factor: number) => MULTIPLIED[factor] ?? `multipliés par ${factor}`

/** Compteur incrémenté à chaque hausse du score : rejoue le « pop » du chiffre. */
function useScorePulse(score: number): number {
  const [tracked, setTracked] = useState({ score, pulse: 0 })
  if (score !== tracked.score) {
    setTracked({ score, pulse: score > tracked.score ? tracked.pulse + 1 : tracked.pulse })
  }
  return tracked.pulse
}

/**
 * Chiffre de la pastille : il rebondit quand le multiplicateur change sous les
 * yeux du joueur (×2 → ×3), pas quand la pastille apparaît.
 */
function MultiplierValue({ factor, reduceMotion }: { factor: number; reduceMotion: boolean }) {
  const [firstFactor] = useState(factor)
  return (
    <motion.span
      key={factor}
      data-slot="level-score-multiplier-value"
      className="inline-block"
      initial={factor !== firstFactor && !reduceMotion ? { scale: 1.8 } : false}
      animate={{ scale: 1 }}
      transition={spring.bouncy}
    >
      ×{factor}
    </motion.span>
  )
}

/**
 * Score de la partie, et pastille du multiplicateur pendant un combo (bleue, ou
 * orangé de flamme pour le combo enflammé du boss) ou l'anneau d'une triade.
 */
export function ScoreCounter({
  score,
  comboActive,
  triadBoost = false,
  comboFire = false,
  multiplier = COMBO_RULES.multiplier,
  className,
}: ScoreCounterProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const pulse = useScorePulse(score)
  const boost = comboActive ? (comboFire ? 'fire' : 'combo') : triadBoost ? 'triad' : null
  const factor = boost === 'triad' ? COMBO_RULES.multiplier : multiplier

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
          // Une seule pastille : passer du combo à la triade, ou au combo enflammé,
          // change sa couleur, sans en monter une seconde à côté de celle qui s'efface.
          <motion.span
            data-slot="level-score-multiplier"
            data-boost={boost}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[0.7rem] leading-none font-bold transition-[background-color,color,box-shadow] duration-200',
              boost === 'fire'
                ? 'bg-combo-fire text-combo-fire-foreground shadow-[0_0_14px_var(--combo-fire-glow)]'
                : boost === 'combo'
                  ? 'bg-combo text-combo-foreground shadow-[0_0_12px_var(--combo-glow)]'
                  : 'bg-triad text-triad-foreground shadow-[0_0_12px_var(--triad-glow)]',
            )}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
            transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
          >
            <MultiplierValue factor={factor} reduceMotion={reduceMotion ?? false} />
            <span className="sr-only">
              {boost === 'triad'
                ? ` : note de triade, points ${multipliedText(factor)} avant la fin du délai`
                : ` : combo ${boost === 'fire' ? 'en feu' : 'actif'}, points ${multipliedText(factor)}`}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
