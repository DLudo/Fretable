import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { HandHelping } from 'lucide-react'

import { NOTATION } from '@/game/config'
import type { AssistState } from '@/game/engine/types'
import { noteName } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { duration, spring } from '@/theme/motion'

export interface AssistChipProps {
  /** Coup de pouce en cours ; `null` : la pastille s'efface. */
  assist: AssistState | null
  className?: string
}

/**
 * Pastille ambrée du coup de pouce : la note répétée et une pastille par note
 * à venir, qui s'éteint une fois jouée. Prend la place de la pastille « ×2 »
 * (combo et coup de pouce ne se cumulent jamais).
 */
export function AssistChip({ assist, className }: AssistChipProps): ReactNode {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence>
      {assist && (
        <motion.span
          data-slot="level-assist"
          role="status"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-assist py-0.5 pr-2 pl-1.5 text-[0.7rem] leading-none font-semibold whitespace-nowrap text-assist-foreground',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
          transition={reduceMotion ? { duration: duration.fast } : spring.bouncy}
        >
          <HandHelping aria-hidden className="size-3.5" />
          <span className="sr-only">
            Coup de pouce : {noteName(assist.pc, NOTATION)}, encore {assist.remaining} fois
          </span>
          {/* Sur écran étroit, l'annonce et le cercle du point suffisent à nommer la note. */}
          <span aria-hidden className="max-sm:hidden">
            {noteName(assist.pc, NOTATION)}
          </span>
          <span aria-hidden className="flex gap-0.5">
            {Array.from({ length: assist.total }, (_, i) => (
              <span
                key={i}
                data-slot="level-assist-step"
                data-done={i < assist.total - assist.remaining || undefined}
                className="size-1.5 rounded-full bg-assist-foreground transition-opacity duration-200 data-done:opacity-25"
              />
            ))}
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
