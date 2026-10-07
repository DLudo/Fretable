import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import type { GameState } from '@/game/engine/types'
import { cn } from '@/lib/utils'
import { spring } from '@/theme/motion'
import { LevelProgress } from './LevelProgress'
import { LevelTimer } from './LevelTimer'

export interface LevelHudProps {
  state: GameState
  className?: string
}

/** Compteur incrémenté à chaque hausse de `value` : sert de clé pour rejouer une animation. */
function useRisePulse(value: number): number {
  const [tracked, setTracked] = useState({ value, pulse: 0 })
  if (value !== tracked.value) {
    setTracked({ value, pulse: value > tracked.value ? tracked.pulse + 1 : tracked.pulse })
  }
  return tracked.pulse
}

/**
 * Bandeau du haut : niveau, notes trouvées, temps restant et progression.
 * Le parent le positionne ; seul `LevelTimer` se re-rend à chaque frame.
 *
 * Sur écran bas (≤ 420 px, téléphone à l'horizontale), tout tient sur une ligne
 * d'environ 36 px — titre, barre de progression extensible, compteur, temps —
 * pour laisser la hauteur au manche. L'ordre du DOM ne change pas : la ligne
 * du haut s'efface (`display: contents`) et la barre se glisse au milieu (`order`).
 */
export function LevelHud({ state, className }: LevelHudProps): ReactNode {
  const { level, correctCount, phase } = state
  const pulseId = useRisePulse(correctCount)
  const reduceMotion = useReducedMotion()

  return (
    <div
      data-slot="level-hud"
      data-phase={phase}
      className={cn('relative w-full select-none', className)}
    >
      <div
        data-slot="level-hud-content"
        className="flex flex-col gap-2 px-4 py-2.5 sm:px-6 short:h-9 short:flex-row short:items-center short:gap-3 short:py-0"
      >
        <div
          data-slot="level-hud-row"
          className="flex items-center gap-3 text-sm leading-none short:contents"
        >
          <span data-slot="level-title" className="truncate font-medium short:shrink-0">
            {level.title}
          </span>

          <span
            data-slot="level-count"
            className="ml-auto inline-flex items-baseline gap-1 tabular-nums whitespace-nowrap short:order-2 short:ml-0"
          >
            <motion.span
              key={pulseId}
              data-slot="level-count-value"
              className="inline-block font-medium"
              initial={pulseId > 0 && !reduceMotion ? { scale: 1.6 } : false}
              animate={{ scale: 1 }}
              transition={spring.bouncy}
            >
              {correctCount}
            </motion.span>
            <span data-slot="level-count-target" className="text-muted-foreground">
              / {level.targetCount}
            </span>
            <span data-slot="level-count-unit" className="text-xs text-muted-foreground">
              notes
            </span>
          </span>

          <span
            aria-hidden
            data-slot="level-hud-separator"
            className="h-3.5 w-px bg-border short:order-2"
          />

          <LevelTimer state={state} className="short:order-2" />
        </div>

        <LevelProgress
          value={correctCount}
          max={level.targetCount}
          pulseId={pulseId}
          className="short:order-1 short:min-w-16 short:flex-1"
        />
      </div>
    </div>
  )
}
