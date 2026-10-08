import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from 'motion/react'

import { COMBO_RULES } from '@/game/config'
import type { ComboState } from '@/game/engine/types'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

export interface ComboMeterProps {
  /** Combo en cours ; `null` : la jauge s'efface. */
  combo: ComboState | null
  className?: string
}

/** Compteur incrémenté à chaque recharge (`endsAt` repoussé) : rejoue l'éclat de la jauge. */
function useRecharge(endsAt: number | null): number {
  const [tracked, setTracked] = useState({ endsAt, pulse: 0 })
  if (endsAt !== tracked.endsAt) {
    const recharged = endsAt !== null && tracked.endsAt !== null && endsAt > tracked.endsAt
    setTracked({ endsAt, pulse: recharged ? tracked.pulse + 1 : tracked.pulse })
  }
  return tracked.pulse
}

/**
 * Jauge de combo, façon barre de mana : bleue, sous la barre de progression.
 * Elle se vide en temps réel sur `COMBO_RULES.maxMs` et regagne du terrain à
 * chaque réponse rapide. Positionnée en absolu sous son parent (qui doit être
 * `relative`) : son apparition ne décale pas la mise en page.
 *
 * Le remplissage est écrit dans le DOM à chaque frame, sans rendu React.
 */
export function ComboMeter({ combo, className }: ComboMeterProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const fill = useRef<HTMLSpanElement>(null)
  const endsAt = combo?.endsAt ?? null
  const recharge = useRecharge(endsAt)

  useAnimationFrame(() => {
    const el = fill.current
    if (!el || endsAt === null) return
    const ratio = Math.min(1, Math.max(0, (endsAt - performance.now()) / COMBO_RULES.maxMs))
    el.style.transform = `scaleX(${ratio})`
  })

  return (
    <AnimatePresence>
      {combo && (
        <motion.div
          key={combo.startedAt}
          aria-hidden
          data-slot="combo-meter"
          className={cn(
            'pointer-events-none absolute inset-x-0 top-full mt-1.5 h-1.5 origin-left rounded-full bg-combo-track short:mt-1 short:h-1',
            className,
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, transition: { duration: duration.base, ease: ease.inQuad } }}
          transition={{ duration: duration.base, ease: ease.outExpo }}
        >
          <span
            ref={fill}
            data-slot="combo-meter-fill"
            className="block h-full origin-left rounded-[inherit] bg-combo shadow-[0_0_10px_1px_var(--combo-glow)]"
          />
          {recharge > 0 && !reduceMotion && (
            <motion.span
              key={recharge}
              data-slot="combo-meter-flash"
              className="absolute inset-0 rounded-[inherit] bg-combo-spark"
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: duration.slow, ease: ease.outQuart }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
