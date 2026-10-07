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
 */
export function LevelHud({ state, className }: LevelHudProps): ReactNode {
  const { level, correctCount, phase } = state
  const pulseId = useRisePulse(correctCount)
  const reduceMotion = useReducedMotion()

  return (
    <div data-slot="level-hud" data-phase={phase} className={cn('relative w-full select-none', className)}>
      <div data-slot="level-hud-content" className="flex flex-col gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3 text-sm leading-none">
          <span data-slot="level-title" className="truncate font-medium">
            {level.title}
          </span>

          <span
            data-slot="level-count"
            className="ml-auto inline-flex items-baseline gap-1 tabular-nums whitespace-nowrap"
          >
            <motion.span
              key={pulseId}
              className="inline-block font-medium"
              initial={pulseId > 0 && !reduceMotion ? { scale: 1.6 } : false}
              animate={{ scale: 1 }}
              transition={spring.bouncy}
            >
              {correctCount}
            </motion.span>
            <span className="text-muted-foreground">/ {level.targetCount}</span>
            <span className="text-xs text-muted-foreground">notes</span>
          </span>

          <span aria-hidden className="h-3.5 w-px bg-border" />

          <LevelTimer state={state} />
        </div>

        <LevelProgress value={correctCount} max={level.targetCount} pulseId={pulseId} />
      </div>
    </div>
  )
}
