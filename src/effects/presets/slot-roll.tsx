import { useMemo } from 'react'
import { motion, useReducedMotion, type Easing, type Transition } from 'motion/react'

import { NOTES } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'
import {
  COMBO_MIN_STREAK,
  REVEAL_CENTERED,
  REVEAL_COMBO,
  REVEAL_PILL,
  comboScaleFor,
  labelFontSize,
  useCompleteAfter,
} from '../kit'
import { range, seededRandom } from '../random'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Machine à sous » : le point s'ouvre en étiquette dans laquelle un rouleau
 * fait défiler quelques notes au hasard en décélérant, dépasse d'un cran puis
 * se verrouille sur la bonne : flash blanc, coup de tampon, onde et confettis.
 * Confettis (6 → 14), onde et coup de tampon montent avec la série.
 */

/** Durée du roulement (s), dépassement et verrouillage compris. */
const ROLL = 0.18
/**
 * Profil du rouleau (fractions de `ROLL`) : défilement à pleine vitesse jusqu'à la case
 * précédant la bonne note, freinage qui dépasse d'un cran, recul de verrouillage.
 */
const BRAKE_AT = 0.42
const OVERSHOOT_AT = 0.78
/** Dépassement (en cases) avant le verrouillage. */
const OVERSHOOT = 0.2
/** Ouverture du point en étiquette (s). */
const OPEN = 0.1
/** Coup de tampon au verrouillage (s). */
const PUNCH = 0.22
/** Durée de vie (ms) : la traîne chevauche la note suivante, affichée ~420 ms après. */
const LIFETIME_MS = 800
/** Début et durée (s) du fondu de sortie global. */
const FADE_AT = 0.46
const FADE_FOR = 0.3
const EXIT: Transition = {
  duration: FADE_AT + FADE_FOR,
  times: [0, FADE_AT / (FADE_AT + FADE_FOR), 1],
  // Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la timeline.
  ease: ['linear', ease.outQuart],
}

/** Mouvement réduit : apparition, maintien, disparition. */
const REDUCED_EASE: Easing[] = [ease.outQuart, 'linear', ease.inQuad]

const SVG_CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface Confetto {
  /** Trajectoire (px) : départ, sommet, chute. */
  x: [number, number, number]
  y: [number, number, number]
  width: number
  height: number
  rotate: number
  spin: number
  /** Tours de « retournement » (rotateX) pendant la chute. */
  flip: number
  white: boolean
  delay: number
  duration: number
}

interface Reel {
  fontSize: number
  /** Hauteur (px) d'une case du rouleau = hauteur de l'étiquette. */
  item: number
  /** Cases du rouleau : défilement, bonne note, case suivante (visible au dépassement). */
  strip: string[]
  /** Index de la bonne note dans `strip`. */
  stop: number
  /** Échelle de départ de l'étiquette : la taille du point. */
  fromX: number
  fromY: number
  punch: number
  tilt: number
  ring: number
  ringScale: number
  confetti: Confetto[]
  glow: number
  comboTilt: number
}

function buildReel(seed: number, intensity: number, markerSize: number, label: string): Reel {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  const item = fontSize * 1.76
  // Le rouleau parle la même notation que l'étiquette, sans case plus longue qu'elle :
  // la fenêtre garde ainsi la largeur de l'étiquette finale.
  const english = NOTES.some((n) => n.english === label)
  const all = NOTES.map((n) => (english ? n.english : n.solfege))
  const fitting = all.filter((n) => [...n].length <= [...label].length)
  const names = fitting.length >= 4 ? fitting : all
  const draw = (avoid: readonly string[]) => {
    const pool = names.filter((n) => !avoid.includes(n))
    return pool[Math.floor(random() * pool.length)]
  }

  const rolls = 5 + Math.floor(random() * 4)
  const strip: string[] = []
  for (let i = 0; i < rolls; i++) {
    // Jamais deux fois la même case de suite, ni la bonne note juste avant l'arrêt.
    strip.push(draw(i === rolls - 1 ? [strip[i - 1], label] : [strip[i - 1] ?? label]))
  }
  strip.push(label, draw([label]))

  // Largeur estimée de l'étiquette (la plus longue case fixe la fenêtre du rouleau).
  const longest = Math.max(...strip.map((s) => [...s].length))
  const width = fontSize * (0.62 * longest + 1.4)

  const count = Math.min(14, Math.max(6, Math.round(6 + 8 * intensity + range(random, -0.5, 0.5))))
  const confetti = Array.from({ length: count }, (_, i): Confetto => {
    // Éventail tourné vers le haut, réparti puis bruité.
    const theta =
      -Math.PI / 2 + ((i + 0.5) / count - 0.5) * range(random, 2.4, 3) + range(random, -0.15, 0.15)
    const x0 = range(random, -0.4, 0.4) * width
    const y0 = range(random, -0.25, 0.25) * item
    const distance = markerSize * range(random, 1.5, 2.8) * (1 + 0.5 * intensity)
    const x1 = x0 + Math.cos(theta) * distance
    const y1 = y0 + Math.sin(theta) * distance
    const size = range(random, 3.5, 5) + 1.5 * intensity
    return {
      x: [x0, x1, x1 + Math.cos(theta) * markerSize * range(random, 0.2, 0.5)],
      y: [y0, y1, y1 + markerSize * range(random, 0.9, 1.6)],
      width: size,
      height: size * range(random, 1.6, 2.4),
      rotate: random() * 180,
      spin: (random() < 0.5 ? -1 : 1) * range(random, 240, 540),
      flip: Math.round(range(random, 1, 3)) * 360,
      white: random() < 0.45,
      delay: ROLL + range(random, 0, 0.03),
      duration: range(random, 0.42, 0.56),
    }
  })

  const ring = markerSize * (3.4 + 2.6 * intensity)
  return {
    fontSize,
    item,
    strip,
    stop: rolls,
    fromX: (markerSize * 0.9) / width,
    fromY: (markerSize * 0.9) / item,
    punch: 1.12 + 0.1 * intensity,
    tilt: (random() < 0.5 ? -1 : 1) * range(random, 2, 5),
    ring,
    ringScale: width / ring,
    confetti,
    glow: 18 + 18 * intensity,
    comboTilt: (random() < 0.5 ? -1 : 1) * range(random, 6, 12),
  }
}

// oxlint-disable-next-line react/only-export-components -- exporté via son descripteur d'effet
function SlotRoll({
  label,
  x,
  y,
  markerSize,
  intensity,
  streak,
  seed,
  color,
  colorForeground,
  onComplete,
}: RevealEffectProps) {
  const reduceMotion = useReducedMotion()
  useCompleteAfter(LIFETIME_MS, onComplete)
  const reel = useMemo(
    () => buildReel(seed, intensity, markerSize, label),
    [seed, intensity, markerSize, label],
  )
  const { fontSize, item, stop, ring } = reel
  const pillStyle = {
    background: color,
    color: colorForeground,
    boxShadow: `0 0 ${reel.glow}px color-mix(in oklch, ${color} 55%, transparent)`,
  }

  if (reduceMotion) {
    return (
      <motion.div
        data-slot="reveal-effect"
        data-effect="slot-roll"
        className="pointer-events-none absolute size-0 overflow-visible"
        style={{ left: x, top: y }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 1] }}
        transition={{ duration: 0.75, times: [0, 0.2, 0.6, 1], ease: REDUCED_EASE }}
      >
        <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
          <span data-slot="reveal-label-pill" className={REVEAL_PILL} style={pillStyle}>
            {label}
          </span>
        </div>
      </motion.div>
    )
  }

  const comboScale = comboScaleFor(streak)
  // Ouverture, attente du verrouillage, coup de tampon, retour au repos.
  const body = ROLL + PUNCH
  const bodyTimes = [0, OPEN / body, ROLL / body, (ROLL + 0.05) / body, 1]
  const bodyEase: Easing[] = [ease.outExpo, 'linear', ease.outQuart, ease.outBack]

  return (
    <motion.div
      data-slot="reveal-effect"
      data-effect="slot-roll"
      className="pointer-events-none absolute size-0 overflow-visible"
      style={{ left: x, top: y }}
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.96] }}
      transition={EXIT}
    >
      {/* Éclair blanc derrière l'étiquette au verrouillage. */}
      <motion.div
        data-slot="reveal-flash"
        className={cn(REVEAL_CENTERED, 'rounded-full')}
        style={{
          width: markerSize * 3,
          height: markerSize * 3,
          background: 'radial-gradient(closest-side, var(--marker), transparent)',
        }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.3 + 0.5 * intensity], opacity: [0, 0.9, 0] }}
        transition={{
          delay: ROLL - 0.01,
          duration: duration.fast + 0.04,
          times: [0, 0.15, 1],
          ease: [ease.outQuart, ease.outQuart],
        }}
      />

      {/* Onde(s) de verrouillage : partent de la largeur de l'étiquette ; un éclair blanc à forte série. */}
      <svg
        data-slot="reveal-rings"
        className={cn(REVEAL_CENTERED, 'overflow-visible')}
        width={ring}
        height={ring}
        viewBox={`${-ring / 2} ${-ring / 2} ${ring} ${ring}`}
        fill="none"
      >
        <motion.circle
          r={ring / 2}
          vectorEffect="non-scaling-stroke"
          strokeWidth={3 + 2 * intensity}
          style={{ ...SVG_CENTERED, stroke: color }}
          initial={{ scale: reel.ringScale, opacity: 0 }}
          animate={{ scale: 1, opacity: [0, 1, 0] }}
          transition={{
            delay: ROLL,
            duration: 0.4,
            ease: ease.outExpo,
            opacity: {
              delay: ROLL,
              duration: 0.34,
              times: [0, 0.05, 1],
              ease: ['linear', ease.outQuart],
            },
          }}
        />
        {intensity > 0.5 && (
          <motion.circle
            r={ring / 2}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            className="stroke-marker"
            style={SVG_CENTERED}
            initial={{ scale: reel.ringScale, opacity: 0 }}
            animate={{ scale: 0.64, opacity: [0, 1, 0] }}
            transition={{
              delay: ROLL,
              duration: 0.26,
              ease: ease.outExpo,
              opacity: {
                delay: ROLL,
                duration: 0.22,
                times: [0, 0.05, 1],
                ease: ['linear', ease.outQuart],
              },
            }}
          />
        )}
      </svg>

      {/* Confettis : jaillissent de l'étiquette, retombent en tournoyant. */}
      {reel.confetti.map((c, i) => (
        <motion.span
          key={i}
          data-slot="reveal-confetti"
          className={cn(REVEAL_CENTERED, 'block rounded-[1px]', c.white && 'bg-marker')}
          style={{ width: c.width, height: c.height, background: c.white ? undefined : color }}
          initial={{ x: c.x[0], y: c.y[0], rotate: c.rotate, rotateX: 0, opacity: 0 }}
          animate={{
            x: c.x,
            y: c.y,
            rotate: c.rotate + c.spin,
            rotateX: c.flip,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            delay: c.delay,
            duration: c.duration,
            times: [0, 0.4, 1],
            ease: [ease.outExpo, ease.inQuad],
            x: {
              delay: c.delay,
              duration: c.duration,
              times: [0, 0.4, 1],
              ease: [ease.outExpo, 'linear'],
            },
            rotate: { delay: c.delay, duration: c.duration, ease: ease.outQuart },
            rotateX: { delay: c.delay, duration: c.duration, ease: 'linear' },
            opacity: {
              delay: c.delay,
              duration: c.duration,
              times: [0, 0.04, 0.72, 1],
              ease: 'linear',
            },
          }}
        />
      ))}

      <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
        {/* Fenêtre du rouleau : le point s'y ouvre, puis coup de tampon au verrouillage. */}
        <motion.div
          data-slot="reveal-label-pill"
          className="relative overflow-hidden rounded-full px-[0.7em] leading-none font-semibold whitespace-nowrap"
          style={{ ...pillStyle, height: item }}
          initial={{ scaleX: reel.fromX, scaleY: reel.fromY, rotate: 0 }}
          animate={{
            scaleX: [reel.fromX, 1, 1, reel.punch, 1],
            scaleY: [reel.fromY, 1, 1, reel.punch, 1],
            rotate: [0, 0, 0, reel.tilt, 0],
          }}
          transition={{ duration: body, times: bodyTimes, ease: bodyEase }}
        >
          {/* Blanc sous le texte : le point blanc qui s'ouvre, puis le flash du verrouillage. */}
          <motion.span
            data-slot="reveal-lock-flash"
            className="absolute inset-0 bg-marker"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 0, 0, 0.9, 0] }}
            transition={{
              duration: ROLL + 0.2,
              times: [
                0,
                OPEN / (ROLL + 0.2),
                (ROLL - 0.005) / (ROLL + 0.2),
                ROLL / (ROLL + 0.2),
                1,
              ],
              ease: [ease.outQuart, 'linear', 'linear', ease.outQuart],
            }}
          />
          <motion.div
            data-slot="reveal-reel"
            className="relative flex flex-col items-center"
            initial={{ y: 0 }}
            animate={{ y: [0, -(stop - 1) * item, -(stop + OVERSHOOT) * item, -stop * item] }}
            transition={{
              duration: ROLL,
              times: [0, BRAKE_AT, OVERSHOOT_AT, 1],
              ease: ['linear', ease.outQuart, ease.outQuart],
            }}
          >
            {reel.strip.map((name, i) => (
              <span
                key={i}
                data-slot={i === stop ? 'reveal-reel-result' : 'reveal-reel-item'}
                className={cn('flex shrink-0 items-center', i !== stop && 'opacity-70')}
                style={{ height: item }}
              >
                {name}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {streak >= COMBO_MIN_STREAK && (
          <motion.span
            data-slot="reveal-combo"
            className={cn(REVEAL_COMBO, '-translate-x-[45%] -translate-y-[60%]')}
            style={{ background: colorForeground, color, boxShadow: `0 0 0 1.5px ${color}` }}
            // Tombe d'en haut comme un symbole de rouleau, puis rebondit.
            initial={{ y: -item * 0.8, scale: 0.4, rotate: 0, opacity: 0 }}
            animate={{ y: 0, scale: comboScale, rotate: reel.comboTilt, opacity: 1 }}
            transition={{
              delay: ROLL + 0.03,
              duration: 0.24,
              ease: ease.outBack,
              opacity: { delay: ROLL + 0.03, duration: 0.05, ease: 'linear' },
            }}
          >
            ×{streak}
          </motion.span>
        )}
      </div>

      {/* Le point d'origine : il s'étire avec l'ouverture et s'efface. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ scaleX: 1, opacity: 1 }}
        animate={{ scaleX: 1.5, opacity: 0 }}
        transition={{
          scaleX: { duration: OPEN, ease: ease.outExpo },
          opacity: { duration: 0.08, ease: 'linear' },
        }}
      />
    </motion.div>
  )
}

export const slotRollEffect: RevealEffect = {
  id: 'slot-roll',
  name: 'Machine à sous',
  outcomes: ['correct'],
  Component: SlotRoll,
}
