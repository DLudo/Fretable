import type { ReactNode } from 'react'
import { Heart, Skull } from 'lucide-react'

import { ScoreCounter } from '@/components/game/hud/ScoreCounter'
import { BOSS_RULES } from '@/game/config'
import { bossComboTier, bossMultiplier, type BossState } from '@/game/boss'
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
 * écran bas), avec deux barres à la place de la progression : la vie du joueur
 * (rouge, cœur) et celle du boss (violette, tête de mort), qui perd un segment
 * à chaque réussite et tombe à zéro quand le boss est vaincu ; le compteur dit
 * combien de coups lui ont été portés.
 */
export function BossHud({ state, leading, className }: BossHudProps): ReactNode {
  const total = BOSS_RULES.bossLife
  // Palier du combo pour la prochaine note : la pastille du score en affiche le multiplicateur.
  const tier = state.phase === 'playing' ? bossComboTier(state.combo) : null
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
          <ScoreCounter
            score={state.score}
            comboActive={tier !== null}
            comboFire={tier === 'fire'}
            multiplier={bossMultiplier(state.combo)}
            className="short:shrink-0"
          />
          <span
            data-slot="boss-count"
            className="ml-auto inline-flex items-baseline gap-1 tabular-nums whitespace-nowrap short:order-2 short:ml-0"
          >
            <span className="font-medium">{total - state.bossLife}</span>
            <span className="text-muted-foreground">/ {total}</span>
            <span className="text-xs text-muted-foreground max-sm:hidden">coups</span>
          </span>
        </div>
        {/* Vie du joueur, puis celle du boss : un segment par coup à lui porter, qui tombe à chaque réussite. */}
        <div
          data-slot="boss-bars"
          className="relative flex flex-col gap-1.5 short:order-1 short:min-w-16 short:flex-1 short:gap-1"
        >
          <div className="flex items-center gap-2">
            <Heart aria-hidden className="size-3 shrink-0 fill-hud-life text-hud-life" />
            <LifeBar life={state.life} max={BOSS_RULES.life.max} />
          </div>
          <div className="flex items-center gap-2">
            <Skull aria-hidden className="size-3 shrink-0 text-boss-life" />
            <LifeBar
              tone="boss"
              life={state.bossLife}
              max={total}
              segments={total}
              label="Vie du boss"
              valueLabel={(value, max) =>
                `Boss : ${value} ${value > 1 ? 'coups restants' : 'coup restant'} sur ${max}`
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
