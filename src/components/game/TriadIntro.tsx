import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'

import { NOTATION, TRIAD_RULES } from '@/game/config'
import type { TriadIntro as TriadIntroState } from '@/game/engine/types'
import { chordName } from '@/game/music/chords'
import { seededRandom } from '@/lib/random'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

/** Sortie de l'annonce (ms) : elle s'achève quand la première note de la triade paraît. */
const EXIT_MS = 180
const EXIT: Transition = { duration: EXIT_MS / 1000, ease: ease.inQuad }
/** Chute de la carte : ressort très raide, un rebond franc, posée en ~200 ms. */
const SLAM: Transition = { type: 'spring', stiffness: 700, damping: 26, mass: 0.7 }
/** Instant de l'impact (s) : onde, éclair et étincelles partent de là. */
const IMPACT = 0.12
const SPARK_COUNT = 26

interface Spark {
  /** Point de départ sur le pourtour de la carte, en % de sa boîte. */
  left: number
  top: number
  /** Trajet vers l'extérieur (px). */
  x: number
  y: number
  size: number
  delay: number
  light: boolean
}

/**
 * Gerbe d'étincelles, tirée une fois par annonce : chacune jaillit du pourtour
 * de la carte (l'ellipse inscrite dans sa boîte) et file vers l'extérieur.
 */
function makeSparks(seed: number): Spark[] {
  const random = seededRandom(seed)
  return Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = (i / SPARK_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.35
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const reach = 70 + random() * 130
    return {
      left: 50 + cos * 50,
      top: 50 + sin * 50,
      x: cos * reach,
      y: sin * reach,
      size: 5 + random() * 8,
      delay: random() * 0.08,
      light: i % 3 === 0,
    }
  })
}

export interface TriadIntroProps {
  /** Triade annoncée (`GameState.triadIntro`), ou `null`. */
  intro: TriadIntroState | null
  className?: string
}

/**
 * Annonce d'une triade, partie en pause : « Trouve » en petit, l'accord en
 * gros (« FA MAJEUR »), encre noire sur carte vert acide. La carte s'abat sur
 * le manche avec une onde, un éclair, une gerbe d'étincelles et un reflet, puis
 * s'envole juste avant la première note : l'annonce tient en
 * `TRIAD_RULES.introMs`, assez brève pour ne pas casser l'élan du joueur.
 * Un voile assombrit la scène et capte les clics le temps de l'annonce.
 */
export function TriadIntro({ intro, className }: TriadIntroProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const at = intro?.at ?? null
  const [leftAt, setLeftAt] = useState<number | null>(null)

  // La carte part un peu avant la fin de la pause : la note la remplace aussitôt.
  useEffect(() => {
    if (at === null) return
    const delay = at + TRIAD_RULES.introMs - EXIT_MS - performance.now()
    const timer = window.setTimeout(() => setLeftAt(at), Math.max(0, delay))
    return () => window.clearTimeout(timer)
  }, [at])

  const sparks = useMemo(() => (at === null ? [] : makeSparks(at)), [at])
  const name = intro ? chordName(intro.root, intro.quality, NOTATION) : ''
  const shown = intro !== null && leftAt !== intro.at

  return (
    <div
      data-slot="triad-intro"
      className={cn(
        'pointer-events-none absolute inset-0 z-30 grid place-items-center overflow-hidden',
        className,
      )}
    >
      <p role="status" className="sr-only">
        {intro ? `Triade : trouve ${name}` : ''}
      </p>
      <AnimatePresence>
        {shown && (
          <motion.div
            key={intro.at}
            aria-hidden
            data-slot="triad-intro-scrim"
            className="pointer-events-auto absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: duration.instant } }}
            exit={{ opacity: 0, transition: EXIT }}
          >
            {!reduceMotion && (
              <motion.div
                data-slot="triad-intro-flash"
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--triad)_0%,var(--triad-glow)_22%,transparent_65%)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.75, 0] }}
                transition={{
                  duration: 0.65,
                  times: [0, 0.15, 1],
                  ease: 'linear',
                  delay: IMPACT - 0.04,
                }}
              />
            )}
            <motion.div
              data-slot="triad-intro-card"
              className="relative"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: -14 }}
              animate={{ opacity: 1, scale: 1, rotate: reduceMotion ? 0 : -3 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: EXIT }
                  : { opacity: 0, scale: 1.18, rotate: -1, transition: EXIT }
              }
              transition={reduceMotion ? { duration: duration.fast } : SLAM}
            >
              {/* Halo qui respire derrière la carte. */}
              <motion.span
                className="absolute -inset-x-16 -inset-y-12 rounded-full bg-[radial-gradient(closest-side,var(--triad-glow),transparent)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: reduceMotion ? 0.6 : [0, 1, 0.65] }}
                transition={{ duration: 0.5, delay: reduceMotion ? 0 : IMPACT }}
              />
              {!reduceMotion &&
                sparks.map((spark, i) => (
                  <motion.span
                    key={i}
                    data-slot="triad-intro-spark"
                    className={cn(
                      'absolute -translate-1/2 rounded-full shadow-[0_0_10px_2px_var(--triad-glow)]',
                      spark.light ? 'bg-reveal-highlight' : 'bg-triad',
                    )}
                    style={{
                      left: `${spark.left}%`,
                      top: `${spark.top}%`,
                      width: spark.size,
                      height: spark.size,
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
                    animate={{ x: spark.x, y: spark.y, opacity: [0, 1, 1, 0], scale: 0.55 }}
                    transition={{
                      duration: 0.8,
                      ease: ease.outExpo,
                      delay: IMPACT + spark.delay,
                      // Projetées d'un coup, elles brillent encore un temps avant de s'éteindre.
                      opacity: {
                        duration: 0.8,
                        times: [0, 0.05, 0.6, 1],
                        ease: 'linear',
                        delay: IMPACT + spark.delay,
                      },
                      scale: { duration: 0.8, ease: 'linear', delay: IMPACT + spark.delay },
                    }}
                  />
                ))}
              {!reduceMotion && (
                <motion.span
                  data-slot="triad-intro-shockwave"
                  className="absolute inset-0 rounded-2xl border-[3px] border-triad"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.9, 0], scale: 1.45 }}
                  transition={{
                    duration: 0.55,
                    ease: ease.outExpo,
                    delay: IMPACT,
                    opacity: { duration: 0.55, times: [0, 0.1, 1], ease: 'linear', delay: IMPACT },
                  }}
                />
              )}
              <div className="relative overflow-hidden rounded-2xl bg-triad px-[clamp(1.5rem,5vw,3rem)] py-[clamp(0.85rem,2.6vw,1.5rem)] text-center text-triad-ink shadow-[0_0_48px_6px_var(--triad-glow),0_14px_40px_-10px_color-mix(in_oklab,var(--key-border)_90%,transparent)]">
                {!reduceMotion && (
                  <motion.span
                    className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-reveal-highlight/60 to-transparent"
                    // Motion porte toute la transformation : l'inclinaison avec la translation.
                    initial={{ x: '-150%', skewX: -20 }}
                    animate={{ x: '400%', skewX: -20 }}
                    transition={{ duration: 0.55, ease: ease.inOut, delay: IMPACT + 0.1 }}
                  />
                )}
                <span className="relative block text-[clamp(0.75rem,2.6vw,1rem)] font-bold tracking-[0.4em] uppercase">
                  Trouve
                </span>
                <span className="relative block text-[clamp(2.25rem,min(10.5vw,15vh),5.5rem)] leading-[0.95] font-black tracking-tight whitespace-nowrap uppercase">
                  {name}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
