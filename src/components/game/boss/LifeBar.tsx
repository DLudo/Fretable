import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion, type Transition } from 'motion/react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { formatLife } from '@/components/game/hud'
import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'

/** La vie suit aussitôt le coup reçu ou la recharge. */
const FILL: Transition = { duration: 0.3, ease: ease.outExpo }
/** La tranche perdue reste un instant visible, puis rejoint la vie (jeu de combat). */
const TRAIL: Transition = { duration: 0.5, ease: ease.outQuart, delay: 0.35 }
const NONE: Transition = { duration: 0 }

/** `player` : la vie du joueur (rouge) ; `boss` : celle du boss (violette). */
export type LifeBarTone = 'player' | 'boss'

const FILL_CLASS: Record<LifeBarTone, string> = {
  player: 'bg-hud-life shadow-[0_0_10px_var(--hud-life)]',
  boss: 'bg-boss-life shadow-[0_0_10px_var(--boss-life)]',
}

/**
 * Entailles entre les segments, de la couleur du fond : le calque s'arrête au
 * dernier segment, pour qu'aucune entaille ne vienne rogner le bout de la
 * barre, et chaque entaille finit sur une frontière. Large de 2 px, elle
 * s'amincit jusqu'au quart du segment quand la barre se resserre, au lieu de
 * la masquer tout entière.
 */
function segmentNotches(notches: number): CSSProperties {
  const period = 100 / notches
  const notch = `min(2px, ${period / 4}%)`
  return {
    width: `${(notches / (notches + 1)) * 100}%`,
    backgroundImage: `repeating-linear-gradient(to right, transparent 0 calc(${period}% - ${notch}), var(--hud-tick) calc(${period}% - ${notch}) ${period}%)`,
  }
}

export interface LifeBarProps {
  life: number
  max: number
  tone?: LifeBarTone
  /** Découpe la barre en autant de segments égaux (pour le boss, un par coup à lui porter). */
  segments?: number
  /** Nom lu par les lecteurs d'écran. */
  label?: string
  /** Valeur lue par les lecteurs d'écran (défaut : « Vie : 72 sur 100 »). */
  valueLabel?: (value: number, max: number) => string
  className?: string
}

/**
 * Barre de vie du boss final, ancrée à gauche : elle se vide de droite à gauche
 * à chaque coup reçu, et la tranche perdue s'attarde, plus claire, avant de
 * disparaître. Celle du joueur est rouge et pulse sous un quart de vie ; celle
 * du boss est violette et découpée en un segment par coup à lui porter
 * (`BOSS_RULES.bossLife`).
 */
export function LifeBar({
  life,
  max,
  tone = 'player',
  segments,
  label = 'Vie',
  valueLabel = (value, total) => `Vie : ${formatLife(value)} sur ${total}`,
  className,
}: LifeBarProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const ratio = max > 0 ? Math.min(1, Math.max(0, life / max)) : 0
  const offset = `${(ratio - 1) * 100}%`
  const critical = tone === 'player' && ratio > 0 && ratio < 0.25
  const notches = segments && segments > 1 ? segments - 1 : 0
  return (
    <ProgressPrimitive.Root
      data-slot="life-bar"
      data-tone={tone}
      data-critical={critical || undefined}
      aria-label={label}
      value={Math.min(max, Math.max(0, life))}
      max={max}
      getValueLabel={valueLabel}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-hud-track', className)}
    >
      <motion.div
        data-slot="life-bar-trail"
        aria-hidden
        className="absolute inset-0 rounded-[inherit] bg-hud-life-trail"
        initial={false}
        animate={{ x: offset }}
        transition={reduceMotion ? NONE : TRAIL}
      />
      <ProgressPrimitive.Indicator asChild>
        <motion.div
          data-slot="life-bar-fill"
          className={cn(
            'absolute inset-0 rounded-[inherit]',
            FILL_CLASS[tone],
            critical && !reduceMotion && 'animate-pulse',
          )}
          initial={false}
          animate={{ x: offset }}
          transition={reduceMotion ? NONE : FILL}
        />
      </ProgressPrimitive.Indicator>
      {notches > 0 && (
        <span
          data-slot="life-bar-segments"
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0"
          style={segmentNotches(notches)}
        />
      )}
    </ProgressPrimitive.Root>
  )
}
