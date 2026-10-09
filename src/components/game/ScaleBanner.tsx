import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Trophy, Waypoints } from 'lucide-react'

import { formatScore } from '@/components/game/hud'
import { NOTATION } from '@/game/config'
import type { ScaleRunOutcome } from '@/game/engine/types'
import { scaleName } from '@/game/music/scales'
import { cn } from '@/lib/utils'
import { duration, ease, spring } from '@/theme/motion'

/** Durée de l'annonce (ms). */
const BANNER_MS = 2400

export interface ScaleBannerProps {
  /** Issue du dernier parcours de gamme : l'annonce s'affiche quand elle change. */
  outcome: ScaleRunOutcome | null
  className?: string
}

/**
 * Fin du parcours de gamme : la gamme jouée, les notes justes et les points
 * gagnés ; un parcours sans faute est célébré. Ne capte pas les clics.
 */
export function ScaleBanner({ outcome, className }: ScaleBannerProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState<ScaleRunOutcome | null>(null)
  const [tracked, setTracked] = useState<ScaleRunOutcome | null>(outcome)
  if (outcome !== tracked) {
    setTracked(outcome)
    setShown(outcome)
  }

  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(null), BANNER_MS)
    return () => window.clearTimeout(timer)
  }, [shown])

  const Icon = shown?.perfect ? Trophy : Waypoints
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.id}
          data-slot="scale-banner"
          data-perfect={shown.perfect || undefined}
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-full bg-triad py-1.5 pr-4 pl-3 text-sm whitespace-nowrap text-triad-foreground short:py-1 short:text-xs max-sm:text-xs',
            shown.perfect && 'shadow-[0_6px_28px_-4px_var(--triad)]',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: duration.base, ease: ease.inQuad } }}
          transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
        >
          <Icon aria-hidden className="size-4" />
          <span className="font-semibold">
            {shown.perfect ? 'Gamme parfaite' : `Gamme : ${shown.hits}/${shown.total}`}
          </span>
          <span className="max-sm:hidden">
            {scaleName(shown.root, shown.quality, shown.kind, NOTATION)}
          </span>
          <span className="font-semibold tabular-nums">+{formatScore(shown.points)}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
