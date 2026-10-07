import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Transition } from 'motion/react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

export interface LevelProgressProps {
  /** Notes trouvées. */
  value: number
  /** Notes à trouver (une graduation par note). */
  max: number
  /** Incrémenté à chaque note trouvée : chaque nouvelle valeur rejoue l'éclat du front. */
  pulseId?: number
  className?: string
}

/** Avancée d'un cran : attaque franche, atterrissage doux. */
const FILL_TRANSITION: Transition = { duration: 0.35, ease: ease.outExpo }
const NO_TRANSITION: Transition = { duration: 0 }

/** Éclat de récompense : le segment gagné gonfle et brille le temps d'arriver, puis se pose. */
const FLASH_TRANSITION: Transition = {
  opacity: { duration: duration.slow, times: [0, 0.2, 1], ease: ['linear', [...ease.outQuart]] },
  scaleY: { duration: duration.reveal, ease: ease.outExpo },
}
const BURST_TRANSITION: Transition = { duration: duration.reveal, ease: ease.outExpo }

const valueLabel = (value: number, max: number) => `${value} notes trouvées sur ${max}`

/**
 * Barre de progression du niveau, découpée en autant de segments que de notes.
 * Sémantique Radix (`role="progressbar"`) ; l'indicateur est animé par Motion.
 */
export function LevelProgress({
  value,
  max,
  pulseId = 0,
  className,
}: LevelProgressProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const safeMax = Math.max(1, max)
  const safeValue = Math.min(safeMax, Math.max(0, value))
  // Indicateur pleine largeur décalé vers la gauche (convention shadcn) : pas de déformation des arrondis.
  const offset = `${(safeValue / safeMax - 1) * 100}%`
  const transition = reduceMotion ? NO_TRANSITION : FILL_TRANSITION
  const segment = `${100 / safeMax}%`

  return (
    <ProgressPrimitive.Root
      data-slot="level-progress"
      value={safeValue}
      max={safeMax}
      getValueLabel={valueLabel}
      aria-label="Progression du niveau"
      className={cn('relative h-2 w-full rounded-full bg-hud-track', className)}
    >
      <div
        data-slot="level-progress-clip"
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
      >
        <ProgressPrimitive.Indicator asChild>
          <motion.div
            data-slot="level-progress-indicator"
            className="size-full rounded-[inherit] bg-hud-fill"
            initial={false}
            animate={{ x: offset }}
            transition={transition}
          />
        </ProgressPrimitive.Indicator>
      </div>

      {Array.from({ length: safeMax - 1 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          data-slot="level-progress-tick"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-hud-tick"
          style={{ left: `${((i + 1) / safeMax) * 100}%` }}
        />
      ))}

      {/* Front de remplissage : suit l'indicateur, hors du rognage pour que l'éclat déborde. */}
      <motion.div
        aria-hidden
        data-slot="level-progress-head"
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{ x: offset }}
        transition={transition}
      >
        {pulseId > 0 && !reduceMotion && (
          <span key={pulseId} className="absolute inset-y-0 right-0" style={{ width: segment }}>
            <motion.span
              data-slot="level-progress-flash"
              className="absolute inset-0 rounded-full bg-hud-fill shadow-[0_0_14px_2px_var(--hud-fill)]"
              initial={{ opacity: 1, scaleY: 2.2 }}
              animate={{ opacity: [1, 1, 0], scaleY: 1 }}
              transition={FLASH_TRANSITION}
            />
            <motion.span
              data-slot="level-progress-burst"
              className="absolute top-1/2 right-0 size-3 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hud-fill"
              initial={{ opacity: 1, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.6 }}
              transition={BURST_TRANSITION}
            />
          </span>
        )}
      </motion.div>
    </ProgressPrimitive.Root>
  )
}
