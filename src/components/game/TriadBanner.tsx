import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Music2, Sparkles } from 'lucide-react'

import { NOTATION } from '@/game/config'
import type { TriadOutcome } from '@/game/engine/types'
import { chordName } from '@/game/music/chords'
import { scaleKindName } from '@/game/music/scales'
import { cn } from '@/lib/utils'
import { duration, ease, spring } from '@/theme/motion'

/** Durée de l'annonce (ms). */
const BANNER_MS = 2200

export interface TriadBannerProps {
  /** Issue de la dernière triade : l'annonce s'affiche quand elle change. */
  outcome: TriadOutcome | null
  className?: string
}

/**
 * Issue d'une triade, en haut de la scène : vert acide quand elle est réussie
 * (avec la gamme dont la forme s'ouvre), sobre quand elle est manquée. Dans les
 * deux cas l'accord est nommé : l'essai sert d'apprentissage. Ne capte pas les clics.
 */
export function TriadBanner({ outcome, className }: TriadBannerProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState<TriadOutcome | null>(null)
  const [tracked, setTracked] = useState<TriadOutcome | null>(outcome)
  if (outcome !== tracked) {
    setTracked(outcome)
    setShown(outcome)
  }

  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(null), BANNER_MS)
    return () => window.clearTimeout(timer)
  }, [shown])

  const Icon = shown?.success ? Sparkles : Music2
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.id}
          data-slot="triad-banner"
          data-success={shown.success || undefined}
          role="status"
          className={cn(
            // Sur écran bas, l'annonce s'affine pour tenir entre le HUD et le manche.
            'pointer-events-none absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pr-4 pl-3 text-sm whitespace-nowrap short:top-0.5 short:py-1 short:text-xs max-sm:text-xs',
            shown.success
              ? 'bg-triad text-triad-foreground shadow-[0_6px_24px_-6px_var(--triad)]'
              : 'bg-secondary text-secondary-foreground',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: duration.base, ease: ease.inQuad } }}
          transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
        >
          <Icon aria-hidden className="size-4" />
          <span className="font-semibold">
            {shown.success ? 'Triade réussie' : 'Triade manquée'}
          </span>
          <span>{chordName(shown.root, shown.quality, NOTATION)}</span>
          {shown.scale && (
            <span data-slot="triad-banner-scale" className="font-semibold">
              → suis la {scaleKindName(shown.quality, shown.scale)}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
