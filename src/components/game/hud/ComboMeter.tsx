import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from 'motion/react'

import { comboCapacityMs } from '@/game/engine/scoring'
import type { ComboState } from '@/game/engine/types'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

export interface ComboMeterProps {
  /** Combo en cours ; `null` : la jauge s'efface. */
  combo: ComboState | null
  /** Début de la pause en cours (annonce de triade, parcours de gamme) : la jauge s'y fige. */
  pausedAt?: number | null
  /** Bonus des amplis (`Perks.comboBonusMs`) : la jauge contient d'autant plus. */
  bonusMs?: number
  className?: string
}

/**
 * Compteur des recharges du combo en cours (`endsAt` repoussé) : rejoue l'éclat
 * de la jauge. Il repart de zéro à chaque nouveau combo, dont la jauge apparaît
 * sans éclat ; la reprise après une pause repousse aussi l'échéance, sans
 * recharger.
 */
function useRecharge(combo: ComboState | null, paused: boolean): number {
  const startedAt = combo?.startedAt ?? null
  const endsAt = combo?.endsAt ?? null
  const [tracked, setTracked] = useState({ startedAt, endsAt, paused, pulse: 0 })
  if (startedAt !== tracked.startedAt) {
    setTracked({ startedAt, endsAt, paused, pulse: 0 })
  } else if (endsAt !== tracked.endsAt || paused !== tracked.paused) {
    const recharged =
      !tracked.paused && endsAt !== null && tracked.endsAt !== null && endsAt > tracked.endsAt
    setTracked({ startedAt, endsAt, paused, pulse: recharged ? tracked.pulse + 1 : tracked.pulse })
  }
  return startedAt === tracked.startedAt ? tracked.pulse : 0
}

/**
 * Jauge de combo, façon barre de mana : bleue, sous la barre de progression.
 * Elle se vide en temps réel sur sa capacité (`comboCapacityMs`) et regagne du terrain à
 * chaque réponse rapide ; elle se fige pendant les pauses (annonce de triade,
 * parcours de gamme). Positionnée en absolu sous son parent (qui doit être
 * `relative`) : son apparition ne décale pas la mise en page.
 *
 * Le remplissage est écrit dans le DOM à chaque frame, sans rendu React.
 */
export function ComboMeter({
  combo,
  pausedAt = null,
  bonusMs = 0,
  className,
}: ComboMeterProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const fill = useRef<HTMLSpanElement>(null)
  const endsAt = combo?.endsAt ?? null
  const recharge = useRecharge(combo, pausedAt !== null)

  useAnimationFrame(() => {
    const el = fill.current
    if (!el || endsAt === null) return
    const at = pausedAt ?? performance.now()
    const ratio = Math.min(1, Math.max(0, (endsAt - at) / comboCapacityMs(bonusMs)))
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
