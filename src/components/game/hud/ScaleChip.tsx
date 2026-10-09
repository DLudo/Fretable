import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Waypoints } from 'lucide-react'

import type { ScaleRunState } from '@/game/engine/types'
import { scaleKindName } from '@/game/music/scales'
import { cn } from '@/lib/utils'
import { duration, spring } from '@/theme/motion'

export interface ScaleChipProps {
  /** Parcours de gamme en cours ; `null` : la pastille s'efface. */
  run: ScaleRunState | null
  className?: string
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Pastille vert acide du parcours de gamme : la gamme et la note en cours sur le total. */
export function ScaleChip({ run, className }: ScaleChipProps): ReactNode {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence>
      {run && (
        <motion.span
          data-slot="level-scale"
          role="status"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-triad py-0.5 pr-2 pl-1.5 text-[0.7rem] leading-none font-semibold whitespace-nowrap text-triad-foreground tabular-nums',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
          transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
        >
          <Waypoints aria-hidden className="size-3.5" />
          {/* Sur écran étroit, le compte seul suffit. */}
          <span className="max-sm:hidden">{capitalize(scaleKindName(run.quality, run.kind))}</span>
          <span>
            <span className="sr-only">note </span>
            {Math.min(run.step + 1, run.notes.length)}/{run.notes.length}
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
