import { useMemo } from 'react'
import { motion, useReducedMotion, type Easing, type Transition } from 'motion/react'

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
import { range, seededRandom } from '@/lib/random'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Soleil » : le point s'embrase, un halo coloré s'étend et une couronne de
 * rayons jaillit derrière l'étiquette en tournant de quelques degrés avant de
 * s'éteindre. Nombre de rayons (8 → 16), portée, dépassement et aiguilles
 * blanches en contre-rotation montent avec la série.
 */

/** Durée de vie (ms) : la traîne chevauche la note suivante, affichée ~420 ms après. */
const LIFETIME_MS = 760
/** Début et durée (s) du fondu de sortie global. */
const FADE_AT = 0.42
const FADE_FOR = 0.3
const EXIT: Transition = {
  duration: FADE_AT + FADE_FOR,
  times: [0, FADE_AT / (FADE_AT + FADE_FOR), 1],
  // Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la timeline.
  ease: ['linear', ease.outQuart],
}

/** Mouvement réduit : apparition, maintien, disparition. */
const REDUCED_EASE: Easing[] = [ease.outQuart, 'linear', ease.inQuad]

interface Ray {
  /** Tracé SVG du rayon (losange effilé), centré sur l'origine. */
  d: string
  delay: number
  duration: number
}

interface Sun {
  fontSize: number
  /** Côté (px) de la boîte des rayons. */
  box: number
  rays: Ray[]
  /** Aiguilles blanches réunies en un seul tracé (forte série uniquement). */
  needles: string | null
  /** Orientation de départ et rotation (deg) de la couronne. */
  turn: number
  spin: number
  tilt: number
  pop: number
  halo: number
  glow: number
  comboTilt: number
}

/** Losange effilé dans la direction `theta` : pointe intérieure, ventre, pointe extérieure. */
function spike(theta: number, inner: number, outer: number, halfWidth: number): string {
  const ux = Math.cos(theta)
  const uy = Math.sin(theta)
  const belly = inner + (outer - inner) * 0.28
  const at = (r: number, w: number) =>
    `${(ux * r - uy * w).toFixed(1)} ${(uy * r + ux * w).toFixed(1)}`
  return `M${at(inner, 0)}L${at(belly, halfWidth)}L${at(outer, 0)}L${at(belly, -halfWidth)}Z`
}

function buildSun(seed: number, intensity: number, markerSize: number): Sun {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  // Nombre pair pour alterner rayons longs et courts.
  const count = 8 + 2 * Math.round(4 * intensity)
  const reach = markerSize * (2.4 + 1.6 * intensity)
  const inner = markerSize * 0.5
  const step = (Math.PI * 2) / count
  // Une fois sur trois, longueurs libres plutôt qu'alternées : la couronne change de caractère.
  const alternate = random() < 0.66

  const rays = Array.from({ length: count }, (_, i): Ray => {
    const long = alternate ? i % 2 === 0 : random() < 0.5
    const theta = (i + range(random, -0.12, 0.12)) * step
    const outer = reach * (long ? range(random, 0.86, 1) : range(random, 0.5, 0.68))
    const halfWidth =
      markerSize * range(random, 0.12, 0.16) * (long ? 1 : 0.75) * (1 + 0.35 * intensity)
    return {
      d: spike(theta, inner, outer, halfWidth),
      delay: range(random, 0, 0.035),
      duration: range(random, 0.36, 0.48),
    }
  })

  // Aiguilles blanches à partir d'une série de 3 environ (intensité ≥ 1/3).
  const needleCount = intensity >= 0.33 ? Math.max(3, Math.round((count / 2) * intensity)) : 0
  const needleOffset = random() * Math.PI * 2
  const needles =
    needleCount > 0
      ? Array.from({ length: needleCount }, (_, i) =>
          spike(
            needleOffset + ((i + range(random, -0.2, 0.2)) / needleCount) * Math.PI * 2,
            markerSize * 0.7,
            reach * range(random, 1.05, 1.3),
            markerSize * 0.05 + 0.6,
          ),
        ).join('')
      : null

  const sign = random() < 0.5 ? -1 : 1
  return {
    fontSize,
    box: Math.ceil(reach * 1.3 * 2 + 8),
    rays,
    needles,
    turn: random() * (360 / count),
    spin: sign * range(random, 7, 14) * (1 + 0.5 * intensity),
    tilt: -sign * range(random, 4, 8),
    pop: 1.08 + 0.06 * intensity,
    halo: 1.25 + 0.85 * intensity,
    glow: 18 + 18 * intensity,
    comboTilt: sign * range(random, 6, 12),
  }
}

// oxlint-disable-next-line react/only-export-components -- exporté via son descripteur d'effet
function Sunburst({
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
  const sun = useMemo(() => buildSun(seed, intensity, markerSize), [seed, intensity, markerSize])
  const { fontSize, box } = sun
  const pillStyle = {
    background: color,
    color: colorForeground,
    boxShadow: `0 0 ${sun.glow}px color-mix(in oklch, ${color} 55%, transparent)`,
  }

  if (reduceMotion) {
    return (
      <motion.div
        data-slot="reveal-effect"
        data-effect="sunburst"
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
  const viewBox = `${-box / 2} ${-box / 2} ${box} ${box}`

  return (
    <motion.div
      data-slot="reveal-effect"
      data-effect="sunburst"
      className="pointer-events-none absolute size-0 overflow-visible"
      style={{ left: x, top: y }}
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.96] }}
      transition={EXIT}
    >
      {/* Halo : disque coloré diffus qui s'étend et s'éteint. */}
      <motion.div
        data-slot="reveal-halo"
        className={cn(REVEAL_CENTERED, 'rounded-full')}
        style={{
          width: markerSize * 3,
          height: markerSize * 3,
          background: `radial-gradient(closest-side, color-mix(in oklch, ${color} 70%, transparent), color-mix(in oklch, ${color} 22%, transparent) 62%, transparent)`,
        }}
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: sun.halo, opacity: 0 }}
        transition={{
          scale: { duration: 0.42, ease: ease.outExpo },
          opacity: { duration: 0.46, ease: ease.outQuart },
        }}
      />

      {/* Couronne de rayons : jaillit du point puis tourne de quelques degrés en s'éteignant. */}
      <motion.div
        data-slot="reveal-rays"
        className={REVEAL_CENTERED}
        style={{ width: box, height: box }}
        initial={{ scale: 0.3, rotate: sun.turn }}
        animate={{ scale: 1, rotate: sun.turn + sun.spin }}
        transition={{
          scale: { duration: 0.36, ease: ease.outExpo },
          rotate: { duration: 0.6, ease: ease.outQuart },
        }}
      >
        <svg className="size-full overflow-visible" viewBox={viewBox}>
          {sun.rays.map((ray) => (
            <motion.path
              key={ray.d}
              d={ray.d}
              style={{ fill: color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.85, 0] }}
              transition={{
                delay: ray.delay,
                duration: ray.duration,
                times: [0, 0.08, 0.4, 1],
                ease: ['linear', 'linear', ease.outQuart],
              }}
            />
          ))}
        </svg>
      </motion.div>

      {/* Forte série : aiguilles de lumière blanches, en contre-rotation. */}
      {sun.needles && (
        <motion.div
          data-slot="reveal-needles"
          className={REVEAL_CENTERED}
          style={{ width: box, height: box }}
          initial={{ scale: 0.25, rotate: 0, opacity: 0 }}
          animate={{ scale: 1, rotate: -sun.spin * 1.6, opacity: [0, 1, 0] }}
          transition={{
            delay: 0.02,
            duration: 0.38,
            ease: ease.outExpo,
            rotate: { delay: 0.02, duration: 0.5, ease: ease.outQuart },
            opacity: { delay: 0.02, duration: 0.38, times: [0, 0.12, 1], ease: 'linear' },
          }}
        >
          <svg className="size-full overflow-visible" viewBox={viewBox}>
            <path d={sun.needles} className="fill-marker" />
          </svg>
        </motion.div>
      )}

      {/* Éclat blanc au cœur, sous l'étiquette. */}
      <motion.div
        data-slot="reveal-flash"
        className={cn(REVEAL_CENTERED, 'rounded-full')}
        style={{
          width: markerSize * 2.2,
          height: markerSize * 2.2,
          background: 'radial-gradient(closest-side, var(--marker), transparent)',
        }}
        initial={{ scale: 0.5, opacity: 1 }}
        animate={{ scale: 1.5 + 0.4 * intensity, opacity: 0 }}
        transition={{ duration: duration.fast, ease: ease.outQuart }}
      />

      {/* Étiquette : jaillit du point (0.3 → dépassement → 1) et se redresse. */}
      <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
        <motion.span
          data-slot="reveal-label-pill"
          className={REVEAL_PILL}
          style={pillStyle}
          initial={{ scale: 0.3, rotate: sun.tilt }}
          animate={{ scale: [0.3, sun.pop, 1], rotate: 0 }}
          transition={{
            duration: 0.32,
            times: [0, 0.42, 1],
            ease: [ease.outExpo, ease.outQuart],
            rotate: { duration: 0.3, ease: ease.outExpo },
          }}
        >
          <motion.span
            className="block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.02, duration: duration.instant }}
          >
            {label}
          </motion.span>
        </motion.span>

        {streak >= COMBO_MIN_STREAK && (
          <motion.span
            data-slot="reveal-combo"
            className={cn(REVEAL_COMBO, '-translate-x-[45%] -translate-y-[58%]')}
            style={{ background: colorForeground, color, boxShadow: `0 0 0 1.5px ${color}` }}
            initial={{ scale: 0, rotate: -sun.comboTilt * 4, opacity: 0 }}
            animate={{
              scale: [0, comboScale * 1.25, comboScale],
              rotate: sun.comboTilt,
              opacity: 1,
            }}
            transition={{
              delay: 0.08,
              duration: 0.24,
              times: [0, 0.5, 1],
              ease: [ease.outExpo, ease.outBack],
              rotate: { delay: 0.08, duration: 0.3, ease: ease.outBack },
              opacity: { delay: 0.08, duration: 0.04, ease: 'linear' },
            }}
          >
            ×{streak}
          </motion.span>
        )}
      </div>

      {/* Le point d'origine : il s'embrase et s'efface sur l'étiquette naissante. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.45, opacity: 0 }}
        transition={{
          scale: { duration: 0.14, ease: ease.outExpo },
          opacity: { duration: 0.1, ease: 'linear' },
        }}
      />
    </motion.div>
  )
}

export const sunburstEffect: RevealEffect = {
  id: 'sunburst',
  name: 'Soleil',
  outcomes: ['correct'],
  Component: Sunburst,
}
