import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Flame } from 'lucide-react'

import { cn } from '@/lib/utils'
import { duration, spring } from '@/theme/motion'

export interface ScoreBoostChipProps {
  /** Multiplicateur des lampes en surchauffe pour la partie ; 1 : la pastille s'efface. */
  multiplier: number
  className?: string
}

/**
 * Pastille orangée des lampes en surchauffe : toute la partie, le score affiché
 * (et les pièces qu'il rapportera) est multiplié.
 */
export function ScoreBoostChip({ multiplier, className }: ScoreBoostChipProps): ReactNode {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence>
      {multiplier > 1 && (
        <motion.span
          data-slot="level-score-boost"
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-combo-fire py-0.5 pr-2 pl-1.5 text-[0.7rem] leading-none font-semibold whitespace-nowrap text-combo-fire-foreground',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
          transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
        >
          <Flame aria-hidden className="size-3.5" />
          <span className="sr-only">Lampes en surchauffe : score multiplié par </span>×{multiplier}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
