import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Transition } from 'motion/react'
import { Timer } from 'lucide-react'

import { GAME_FEEL } from '@/game/config'
import type { GameState } from '@/game/engine/types'
import { useCountdown } from '@/game/engine/useCountdown'
import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'
import { formatSeconds } from './format'

export interface LevelTimerProps {
  state: Pick<GameState, 'phase' | 'startedAt' | 'endedAt' | 'level'>
  className?: string
  /** Classes de la barre de temps (`level-timebar`). */
  barClassName?: string
}

/** Pulsation discrète de chaque seconde critique. */
const BEAT_TRANSITION: Transition = { duration: 0.45, ease: ease.outExpo }

/**
 * Temps restant : libellé et barre de temps qui se vide.
 *
 * Seul composant du HUD rafraîchi à chaque frame (il appelle `useCountdown`) :
 * il porte donc aussi la barre, positionnée en absolu au bas du premier ancêtre
 * positionné — la racine du HUD — sur toute sa largeur.
 */
export function LevelTimer({ state, className, barClassName }: LevelTimerProps): ReactNode {
  const remaining = useCountdown(state)
  const reduceMotion = useReducedMotion()
  const total = state.level.durationMs
  const ratio = total > 0 ? remaining / total : 0
  const critical = remaining < GAME_FEEL.criticalTimeMs
  // Clé changée à chaque seconde entamée en zone critique : le libellé est remonté et pulse.
  const beat = critical && state.phase === 'playing' ? Math.ceil(remaining / 1000) : 0
  const pulse = beat > 0 && !reduceMotion

  return (
    <>
      <span
        data-slot="level-timer"
        data-critical={critical || undefined}
        role="timer"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium tabular-nums whitespace-nowrap transition-colors duration-200',
          critical ? 'text-hud-time-critical' : 'text-foreground',
          className,
        )}
      >
        <Timer aria-hidden className={cn('size-3.5', !critical && 'text-muted-foreground')} />
        <span className="sr-only">Temps restant :</span>
        <motion.span
          key={beat}
          data-slot="level-timer-value"
          className="inline-block min-w-[4.25ch] text-right"
          initial={pulse ? { scale: 1.16, opacity: 0.6 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={BEAT_TRANSITION}
        >
          {formatSeconds(remaining, 'ceil')}
        </motion.span>
      </span>

      <span
        aria-hidden
        data-slot="level-timebar"
        data-critical={critical || undefined}
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-hud-track',
          barClassName,
        )}
      >
        <span
          data-slot="level-timebar-fill"
          className={cn(
            'block h-full origin-left transition-colors duration-200',
            critical ? 'bg-hud-time-critical' : 'bg-hud-time',
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </span>
    </>
  )
}
