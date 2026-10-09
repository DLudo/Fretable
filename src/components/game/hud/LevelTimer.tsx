import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { Pause, Timer } from 'lucide-react'

import { GAME_FEEL } from '@/game/config'
import { totalDurationMs } from '@/game/engine/selectors'
import { useCountdown, type CountdownState } from '@/game/engine/useCountdown'
import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'
import { formatClock, formatClockSpoken } from './format'

export interface LevelTimerProps {
  state: CountdownState
  className?: string
  /** Classes de la barre de temps (`level-timebar`). */
  barClassName?: string
}

/** Pulsation discrète de chaque seconde critique. */
const BEAT_TRANSITION: Transition = { duration: 0.45, ease: ease.outExpo }

/** Temps accordé (« +10 s ») : surgit sous le minuteur, par-dessus la barre, s'y attarde, puis s'efface. */
const BONUS_POP_TRANSITION: Transition = {
  duration: 1.6,
  times: [0, 0.14, 0.78, 1],
  ease: [[...ease.outBack], 'linear', [...ease.inQuad]],
}

interface BonusPop {
  id: number
  gainedMs: number
}

/** Détecte chaque hausse de `bonusTimeMs` : la pastille « +N s » vit le temps de son animation. */
function useBonusPop(bonusTimeMs: number) {
  const [tracked, setTracked] = useState(bonusTimeMs)
  const [pop, setPop] = useState<BonusPop | null>(null)
  if (bonusTimeMs !== tracked) {
    setTracked(bonusTimeMs)
    setPop(
      bonusTimeMs > tracked ? { id: (pop?.id ?? 0) + 1, gainedMs: bonusTimeMs - tracked } : null,
    )
  }
  return [pop, () => setPop(null)] as const
}

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
  const [bonusPop, clearBonusPop] = useBonusPop(state.bonusTimeMs)
  // Le temps accordé allonge aussi la barre : la part restante ne fait que croître.
  const total = totalDurationMs(state)
  const ratio = total > 0 ? remaining / total : 0
  const critical = remaining < GAME_FEEL.criticalTimeMs
  const boosted = bonusPop !== null
  // Temps suspendu (parcours de gamme) : icône de pause, couleur du bonus.
  const paused = state.phase === 'playing' && state.pausedAt !== null
  // Clé changée à chaque seconde entamée en zone critique : le libellé est remonté et pulse.
  const beat = critical && state.phase === 'playing' && !paused ? Math.ceil(remaining / 1000) : 0
  const pulse = beat > 0 && !reduceMotion

  return (
    <>
      <span
        data-slot="level-timer"
        data-critical={critical || undefined}
        data-boosted={boosted || undefined}
        data-paused={paused || undefined}
        role="timer"
        className={cn(
          'relative inline-flex items-center gap-1.5 text-sm font-medium tabular-nums whitespace-nowrap transition-colors duration-200',
          boosted
            ? 'text-assist'
            : paused
              ? 'text-triad'
              : critical
                ? 'text-hud-time-critical'
                : 'text-foreground',
          className,
        )}
      >
        {paused ? (
          <Pause aria-hidden className="size-3.5" />
        ) : (
          <Timer aria-hidden className={cn('size-3.5', !critical && 'text-muted-foreground')} />
        )}
        <span className="sr-only">
          {paused ? 'Temps suspendu :' : 'Temps restant :'} {formatClockSpoken(remaining, 'ceil')}
        </span>
        <motion.span
          key={beat}
          data-slot="level-timer-value"
          aria-hidden
          className="inline-block min-w-[4.25ch] text-right"
          initial={pulse ? { scale: 1.16, opacity: 0.6 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={BEAT_TRANSITION}
        >
          {formatClock(remaining, 'ceil')}
        </motion.span>
        <AnimatePresence>
          {bonusPop && (
            <motion.span
              key={bonusPop.id}
              aria-hidden
              data-slot="level-timer-bonus"
              className="pointer-events-none absolute top-full right-0 z-10 mt-1.5 rounded-full bg-assist px-1.5 py-0.5 text-[0.7rem] leading-none font-semibold text-assist-foreground"
              initial={{ opacity: 0, y: reduceMotion ? 0 : -6, scale: reduceMotion ? 1 : 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: reduceMotion ? 0 : [-6, 0, 0, 3],
                scale: reduceMotion ? 1 : [0.6, 1, 1, 0.95],
              }}
              transition={BONUS_POP_TRANSITION}
              onAnimationComplete={clearBonusPop}
            >
              +{Math.round(bonusPop.gainedMs / 1000)} s
            </motion.span>
          )}
        </AnimatePresence>
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
            boosted ? 'bg-assist' : critical ? 'bg-hud-time-critical' : 'bg-hud-time',
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </span>
    </>
  )
}
