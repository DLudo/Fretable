import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { HandHelping } from 'lucide-react'

import { NOTATION } from '@/game/config'
import type { AssistState } from '@/game/engine/types'
import { noteName } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { duration, ease, spring } from '@/theme/motion'

/** Durée de l'annonce (ms) ; la pastille du HUD prend ensuite le relais. */
const BANNER_MS = 1900

export interface AssistBannerProps {
  /** Coup de pouce en cours : l'annonce s'affiche à son arrivée. */
  assist: AssistState | null
  className?: string
}

/**
 * Annonce du coup de pouce, en haut de la scène : brève, bien visible, sans
 * capter les clics. Ne s'affiche qu'à l'arrivée du coup de pouce (pas à
 * chaque note répétée).
 */
export function AssistBanner({ assist, className }: AssistBannerProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const offered = assist !== null && assist.remaining === assist.total ? assist : null
  const [shown, setShown] = useState<AssistState | null>(null)
  const [tracked, setTracked] = useState<AssistState | null>(null)
  if (offered !== tracked) {
    setTracked(offered)
    if (offered) setShown(offered)
  }

  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(null), BANNER_MS)
    return () => window.clearTimeout(timer)
  }, [shown])

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key="assist-banner"
          data-slot="assist-banner"
          role="status"
          className={cn(
            // Sur écran bas, l'annonce s'affine pour tenir entre le HUD et le manche.
            'pointer-events-none absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-assist py-1.5 pr-4 pl-3 text-sm whitespace-nowrap text-assist-foreground shadow-[0_6px_24px_-6px_var(--assist)] short:top-0.5 short:py-1 short:text-xs',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: duration.base, ease: ease.inQuad } }}
          transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
        >
          <HandHelping aria-hidden className="size-4" />
          <span className="font-semibold">Coup de pouce</span>
          <span>
            {noteName(shown.pc, NOTATION)}, {shown.total} fois de suite
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
