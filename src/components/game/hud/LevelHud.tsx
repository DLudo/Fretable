import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import type { GameState } from '@/game/engine/types'
import { cn } from '@/lib/utils'
import { spring } from '@/theme/motion'
import { AssistChip } from './AssistChip'
import { ComboMeter } from './ComboMeter'
import { LevelProgress } from './LevelProgress'
import { LevelTimer } from './LevelTimer'
import { ScaleChip } from './ScaleChip'
import { ScoreCounter } from './ScoreCounter'

export interface LevelHudProps {
  state: GameState
  /** Anneau d'une note de triade en cours : pastille « ×2 » en vert acide. */
  triadBoost?: boolean
  /** Élément posé en tête de la ligne, à gauche du titre (interrupteur de mode). */
  leading?: ReactNode
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
 * Bandeau du haut : niveau, score, notes trouvées, temps restant, progression
 * et, pendant un combo, la jauge bleue sous la progression. Pendant un coup de
 * pouce, le cran suivant se remplit en ambre, une bonne réponse à la fois.
 * Le parent le positionne ; seul `LevelTimer` se re-rend à chaque frame
 * (`ComboMeter` écrit directement dans le DOM).
 *
 * Sur écran bas (≤ 420 px, téléphone à l'horizontale), tout tient sur une ligne
 * d'environ 36 px — titre, barre de progression extensible, compteur, temps —
 * pour laisser la hauteur au manche. L'ordre du DOM ne change pas : la ligne
 * du haut s'efface (`display: contents`) et la barre se glisse au milieu (`order`).
 */
export function LevelHud({
  state,
  triadBoost = false,
  leading,
  className,
}: LevelHudProps): ReactNode {
  const { level, correctCount, phase, score, combo, assist, scaleRun } = state
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
        className="flex flex-col gap-2 px-4 pt-2.5 pb-4 sm:px-6 short:h-9 short:flex-row short:items-center short:gap-3 short:py-0"
      >
        <div
          data-slot="level-hud-row"
          className="flex items-center gap-2 text-sm leading-none sm:gap-3 short:contents"
        >
          {leading}
          <span data-slot="level-title" className="truncate font-medium short:shrink-0">
            {level.title}
          </span>

          <ScoreCounter
            score={score}
            comboActive={combo !== null}
            triadBoost={triadBoost}
            className="short:shrink-0"
          />
          <AssistChip assist={assist} className="short:shrink-0" />
          <ScaleChip run={scaleRun} className="short:shrink-0" />

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

        {/* La jauge de combo se pose sous la progression, sans décaler la mise en page. */}
        <div data-slot="level-bars" className="relative short:order-1 short:min-w-16 short:flex-1">
          <LevelProgress
            value={correctCount}
            max={level.targetCount}
            pulseId={pulseId}
            pending={assist && { done: assist.total - assist.remaining, total: assist.total }}
          />
          <ComboMeter combo={combo} />
        </div>
      </div>
    </div>
  )
}
