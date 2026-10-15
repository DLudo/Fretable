import { useEffect, useState, type ReactNode } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { Star } from 'lucide-react'

import { formatScore } from '@/components/game/hud'
import type { CoinReceipt } from '@/game/coins'
import { cn } from '@/lib/utils'
import { duration, ease, spring } from '@/theme/motion'
import { Coin } from './Coin'

/** Étapes de la conversion, dans l'ordre. */
type Stage = 'wait' | 'convert' | 'bonus' | 'merge' | 'total' | 'done'
const ORDER: Stage[] = ['wait', 'convert', 'bonus', 'merge', 'total', 'done']
const reached = (stage: Stage, step: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(step)

/** Décompte du score en pièces : plus il y en a, plus il dure, dans des bornes (s). */
const convertSeconds = (coins: number) => Math.min(1.6, 0.7 + Math.log10(Math.max(1, coins)) * 0.25)
/** La prime d'étoiles se pose, puis file se fondre dans le compteur (s). */
const BONUS_HOLD = 0.55
const BONUS_FLIGHT = 0.22
/** Pièces qui volent du score vers le compteur, au plus. */
const PARTICLES_MAX = 12
/** Vol d'une pièce (s). */
const FLIGHT = 0.55
/** Départ des pièces : sur le score, juste au-dessus du bloc (px). */
const FROM = { x: 30, spread: 110, y: -30 }
/** Arrivée : l'icône du compteur (coin haut gauche d'une pièce de 16 px). */
const TO = { x: 4, y: 4 }

export interface CoinConversionProps {
  /** Reçu du crédit : pièces de la partie et solde avant, après. */
  receipt: CoinReceipt
  /** Attente avant la conversion (s), le temps que l'écran de fin se pose. */
  delay?: number
  className?: string
}

/** Valeur animée affichée en nombre (séparateurs de milliers). */
function useCount(value: MotionValue<number>) {
  return useTransform(value, (v) => formatScore(v))
}

/**
 * Conversion du score en pièces, à la fin d'une partie. Des pièces filent du
 * score vers le compteur, qui grimpe jusqu'aux pièces du score (1 000 points =
 * 100 pièces) ; sur une victoire, la prime des étoiles s'abat à côté (« +700 »
 * et ses étoiles), puis s'y fond, et le compteur bondit d'autant. Le solde du
 * portefeuille suit, de l'ancien au nouveau. En mouvement réduit, tout est posé
 * d'emblée. Le portefeuille est crédité ailleurs (`useCoinReward`), avant
 * l'animation : la passer ne coûte rien.
 */
export function CoinConversion({
  receipt,
  delay = 0.4,
  className,
}: CoinConversionProps): ReactNode {
  const reduceMotion = useReducedMotion() ?? false
  const { reward, before, after } = receipt
  const coins = useMotionValue(reduceMotion ? reward.total : 0)
  const balance = useMotionValue(reduceMotion ? after : before)
  const coinsText = useCount(coins)
  const balanceText = useCount(balance)
  const [stage, setStage] = useState<Stage>(reduceMotion ? 'done' : 'wait')
  // Chaque pièce arrivée fait sursauter l'icône du compteur.
  const [bumps, setBumps] = useState(0)

  const seconds = convertSeconds(reward.fromScore)
  const particles =
    reward.fromScore > 0
      ? Math.min(PARTICLES_MAX, Math.max(3, Math.round(reward.fromScore / 120)))
      : 0

  useEffect(() => {
    if (reduceMotion) {
      coins.set(reward.total)
      balance.set(after)
      return
    }
    let cancelled = false
    const running: { stop: () => void }[] = []
    const sleep = (s: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, s * 1000)
        running.push({ stop: () => window.clearTimeout(timer) })
      })
    const tween = (
      value: MotionValue<number>,
      to: number,
      s: number,
      curve: readonly [number, number, number, number] = ease.outQuart,
    ) => {
      const controls = animate(value, to, { duration: s, ease: curve })
      running.push(controls)
      return controls
    }
    const run = async () => {
      await sleep(delay)
      if (cancelled) return
      setStage('convert')
      await tween(coins, reward.fromScore, seconds)
      if (cancelled) return
      if (reward.completion > 0) {
        setStage('bonus')
        await sleep(BONUS_HOLD)
        if (cancelled) return
        setStage('merge')
        await sleep(BONUS_FLIGHT)
        if (cancelled) return
        await tween(coins, reward.total, 0.5, ease.outExpo)
        if (cancelled) return
      }
      setStage('total')
      await tween(balance, after, 0.7)
      if (!cancelled) setStage('done')
    }
    coins.set(0)
    balance.set(before)
    void run()
    return () => {
      cancelled = true
      running.forEach((r) => r.stop())
    }
  }, [reduceMotion, delay, seconds, reward, before, after, coins, balance])

  const summary =
    `${formatScore(reward.fromScore)} pièces pour le score` +
    (reward.completion > 0
      ? `, ${formatScore(reward.completion)} de prime pour ${reward.stars} étoile${reward.stars > 1 ? 's' : ''}`
      : '') +
    `. Solde : ${formatScore(after)} pièces.`

  return (
    <div
      data-slot="coin-conversion"
      data-stage={stage}
      className={cn('relative flex flex-col gap-1', className)}
    >
      <p className="sr-only">{summary}</p>
      <div
        aria-hidden
        data-slot="coin-conversion-row"
        className={cn(
          'flex items-center gap-2 transition-opacity duration-300',
          !reached(stage, 'convert') && 'opacity-0',
        )}
      >
        <span className="relative inline-flex">
          <motion.span
            key={bumps}
            className="inline-flex"
            initial={bumps > 0 && !reduceMotion ? { scale: 1.35, rotate: -12 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.pop}
          >
            <Coin className="size-6 drop-shadow-[0_0_8px_var(--coin)]" />
          </motion.span>
          {/* Onde dorée quand la prime se fond dans le compteur. */}
          {stage === 'merge' && !reduceMotion && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-coin"
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: duration.slow, ease: ease.outExpo }}
            />
          )}
        </span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          {/* Le compteur bondit quand la prime s'y fond. */}
          <motion.span
            className="inline-block origin-left text-2xl font-semibold tracking-tight text-coin"
            animate={
              stage === 'total' && reward.completion > 0 && !reduceMotion
                ? { scale: [1, 1.2, 1] }
                : { scale: 1 }
            }
            transition={{ duration: duration.reveal, ease: ease.outBack }}
          >
            +<motion.span data-slot="coin-conversion-count">{coinsText}</motion.span>
          </motion.span>
          <span className="text-sm text-muted-foreground">pièces</span>
        </span>
        {reward.completion > 0 && (stage === 'bonus' || stage === 'merge') && (
          <motion.span
            data-slot="coin-conversion-bonus"
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-coin px-2 py-0.5 text-sm font-bold text-background shadow-[0_0_14px_var(--coin)] tabular-nums"
            initial={{ scale: 0.2, opacity: 0, rotate: -14 }}
            animate={
              stage === 'merge'
                ? { x: -72, scale: 0.3, opacity: 0, rotate: 0 }
                : { x: 0, scale: 1, opacity: 1, rotate: 0 }
            }
            transition={
              stage === 'merge' ? { duration: BONUS_FLIGHT, ease: ease.inQuad } : spring.pop
            }
          >
            +{formatScore(reward.completion)}
            <span className="inline-flex">
              {Array.from({ length: reward.stars }, (_, i) => (
                <Star key={i} className="size-3 fill-current" strokeWidth={0} />
              ))}
            </span>
          </motion.span>
        )}
      </div>
      <p
        aria-hidden
        data-slot="coin-conversion-balance"
        className={cn(
          'text-sm text-muted-foreground tabular-nums transition-opacity duration-300',
          !reached(stage, 'total') && 'opacity-0',
        )}
      >
        Solde : <motion.span className="font-semibold text-foreground">{balanceText}</motion.span>{' '}
        pièces
      </p>
      {/* Pièces qui filent du score vers le compteur, le temps du décompte. */}
      {stage === 'convert' &&
        Array.from({ length: particles }, (_, i) => {
          // Départs répartis sur la largeur du score, sans hasard au rendu.
          const x = FROM.x + ((i * 0.618) % 1) * FROM.spread
          return (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0"
              initial={{ x, y: FROM.y, scale: 0.5, opacity: 0 }}
              animate={{
                x: [x, (x + TO.x) / 2, TO.x],
                y: [FROM.y, FROM.y - 22, TO.y],
                scale: [0.5, 1.1, 0.75],
                opacity: [0, 1, 1],
              }}
              transition={{
                duration: FLIGHT,
                delay: (i * Math.max(0, seconds - FLIGHT * 0.6)) / particles,
                ease: ease.inQuad,
                times: [0, 0.4, 1],
              }}
              onAnimationComplete={() => setBumps((n) => n + 1)}
            >
              <Coin className="size-4 drop-shadow-[0_0_6px_var(--coin)]" />
            </motion.span>
          )
        })}
    </div>
  )
}
