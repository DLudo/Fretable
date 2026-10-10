import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Transition } from 'motion/react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'

/** La vie suit aussitôt le coup reçu ou la recharge. */
const FILL: Transition = { duration: 0.3, ease: ease.outExpo }
/** La tranche perdue reste un instant visible, puis rejoint la vie (jeu de combat). */
const TRAIL: Transition = { duration: 0.5, ease: ease.outQuart, delay: 0.35 }
const NONE: Transition = { duration: 0 }

export interface LifeBarProps {
  life: number
  max: number
  className?: string
}

/**
 * Barre de vie du boss final, en lieu et place de la progression : rouge,
 * ancrée à gauche, elle se vide de droite à gauche à chaque coup reçu. La
 * tranche perdue s'attarde, plus claire, avant de disparaître ; sous un quart
 * de vie, la barre pulse.
 */
export function LifeBar({ life, max, className }: LifeBarProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const ratio = max > 0 ? Math.min(1, Math.max(0, life / max)) : 0
  const offset = `${(ratio - 1) * 100}%`
  const critical = ratio > 0 && ratio < 0.25
  return (
    <ProgressPrimitive.Root
      data-slot="life-bar"
      data-critical={critical || undefined}
      value={Math.round(life)}
      max={max}
      getValueLabel={(value, total) => `Vie : ${value} sur ${total}`}
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
            'absolute inset-0 rounded-[inherit] bg-hud-life shadow-[0_0_10px_var(--hud-life)]',
            critical && !reduceMotion && 'animate-pulse',
          )}
          initial={false}
          animate={{ x: offset }}
          transition={reduceMotion ? NONE : FILL}
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}
