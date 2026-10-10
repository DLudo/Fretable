import type { ReactNode } from 'react'

import { ScoreCounter } from '@/components/game/hud/ScoreCounter'
import { BOSS_RULES } from '@/game/config'
import type { BossState } from '@/game/boss'
import { cn } from '@/lib/utils'
import { LifeBar } from './LifeBar'

export interface BossHudProps {
  state: BossState
  /** Élément posé en tête de la ligne, à gauche du titre (interrupteur de mode). */
  leading?: ReactNode
  className?: string
}

/**
 * Bandeau du boss final : même gabarit que celui des niveaux (ligne unique sur
 * écran bas), avec la barre de vie à la place de la progression.
 */
export function BossHud({ state, leading, className }: BossHudProps): ReactNode {
  const total = state.notes.length || BOSS_RULES.noteCount
  return (
    <div
      data-slot="boss-hud"
      data-phase={state.phase}
      className={cn('relative w-full select-none', className)}
    >
      <div className="flex flex-col gap-2 px-4 pt-2.5 pb-4 sm:px-6 short:h-9 short:flex-row short:items-center short:gap-3 short:py-0">
        <div className="flex items-center gap-2 text-sm leading-none sm:gap-3 short:contents">
          {leading}
          <span data-slot="boss-title" className="truncate font-medium short:shrink-0">
            Boss final
          </span>
          <ScoreCounter score={state.score} comboActive={false} className="short:shrink-0" />
          <span
            data-slot="boss-count"
            className="ml-auto inline-flex items-baseline gap-1 tabular-nums whitespace-nowrap short:order-2 short:ml-0"
          >
            <span className="font-medium">{state.cursor}</span>
            <span className="text-muted-foreground">/ {total}</span>
            <span className="text-xs text-muted-foreground max-sm:hidden">notes</span>
          </span>
        </div>
        <div className="relative short:order-1 short:min-w-16 short:flex-1">
          <LifeBar life={state.life} max={BOSS_RULES.life.max} />
        </div>
      </div>
    </div>
  )
}
