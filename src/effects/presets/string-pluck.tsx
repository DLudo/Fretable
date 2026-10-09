import { useId, useMemo } from 'react'
import { motion } from 'motion/react'

import { range, seededRandom } from '@/lib/random'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'
import {
  REVEAL_CENTERED,
  REVEAL_PILL,
  RevealCombo,
  RevealRoot,
  comboScaleFor,
  estimateLabelBox,
  labelFontSize,
  revealExit,
  revealPillStyle,
  useCompleteAfter,
} from '../kit'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Corde pincée » : le point s'écrase sur la corde comme sous le doigt, puis
 * la corde est relâchée : deux traits de lumière filent le long de la corde
 * dans les deux sens (jamais au-delà du sillet), le segment autour du point
 * vibre (oscillation amortie) et l'étiquette s'élève un peu en éclosant. Plus
 * la série monte, plus les traits vont loin et plus de vrais fils de frette
 * (`fretOffsets`) s'allument sur leur passage.
 */

/** Le doigt écrase la corde avant de la relâcher (s). */
const PLUCK = 0.035
/** Durée de la vibration (s). */
const VIBRATION = 0.26
/** Élévation de l'étiquette, en diamètres de repère : elle reste sur sa corde. */
const RISE = 0.5
/** Un fil de frette ne s'allume que si la tête l'atteint avant cette fraction de sa course. */
const FRET_REACH = 0.92

/**
 * Origine du groupe qui vibre : milieu du bord haut de sa boîte (fill-box), soit
 * le centre du segment sur l'axe de la corde, l'arc étant tracé sous l'axe.
 * (Motion ignore un `transformOrigin` brut sur un élément SVG : passer par originX/Y.)
 */
const SVG_AXIS_ORIGIN = { originX: 0.5, originY: 0 } as const

/** Instant (fraction de la durée) où une courbe ease-out « expo » atteint `f` de sa course. */
function reachTime(f: number): number {
  return Math.min(1, -Math.log2(1 - Math.min(f, 0.999)) / 10)
}

interface FretFlash {
  /** Distance au point, le long de la corde (px) : celle d'un vrai fil de frette. */
  at: number
  delay: number
}

interface Side {
  /** Course de la tête lumineuse (px), positive dans le sens du trait. */
  travel: number
  delay: number
  duration: number
  frets: FretFlash[]
}

interface Pluck {
  fontSize: number
  /** Échelle de départ de l'étiquette : la taille du point. */
  fromX: number
  fromY: number
  angle: number
  sides: [Side, Side]
  thickness: number
  headLength: number
  fretHeight: number
  /** Demi-longueur et amplitude du segment qui vibre (px). */
  halfLength: number
  amplitude: number
  /** Amplitudes relatives successives de l'oscillation amortie. */
  wobble: number[]
  rise: number
  tilt: number
  glow: number
  comboTilt: number
}

function buildPluck(
  seed: number,
  intensity: number,
  markerSize: number,
  pxPerMm: number,
  stringAngle: number,
  fretOffsets: readonly number[],
  label: string,
): Pluck {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  const { halfW, halfH } = estimateLabelBox(fontSize, label)

  const reach = pxPerMm * (40 + 50 * intensity)
  const fretsPerSide = Math.round(3 * intensity)
  // Distance (px) du point au sillet (index 0), là où la corde s'arrête.
  const nut = fretOffsets.length > 0 ? -fretOffsets[0] : Infinity
  /** `dir` : +1 vers le chevalet, -1 vers le sillet. */
  const side = (dir: 1 | -1): Side => {
    const travel = Math.min(reach * range(random, 0.8, 1.15), dir < 0 ? nut : Infinity)
    const delay = PLUCK + range(random, 0, 0.02)
    const dur = range(random, 0.38, 0.48)
    // Les vrais fils de frette de ce côté, du plus proche au plus lointain, allumés
    // quand la tête passe dessus.
    const frets = fretOffsets
      .map((offset) => offset * dir)
      .filter((at) => at > 0 && at <= travel * FRET_REACH)
      .sort((a, b) => a - b)
      .slice(0, fretsPerSide)
      .map((at): FretFlash => ({ at, delay: delay + dur * reachTime(at / travel) }))
    return { travel, delay, duration: dur, frets }
  }

  // Oscillation amortie : 6 à 8 alternances, sens du pincement tiré au sort.
  const sign = random() < 0.5 ? -1 : 1
  const swings = 6 + Math.floor(random() * 3)
  const damping = range(random, 0.28, 0.4)
  const wobble = Array.from({ length: swings + 1 }, (_, i) =>
    i === swings ? 0 : sign * (i % 2 === 0 ? 1 : -1) * Math.exp(-i * damping),
  )

  return {
    fontSize,
    fromX: (markerSize * 0.9) / (2 * halfW),
    fromY: (markerSize * 0.9) / (2 * halfH),
    angle: (stringAngle * 180) / Math.PI,
    sides: [side(1), side(-1)],
    thickness: 2.5 + 1.5 * intensity,
    headLength: markerSize * (1.3 + 0.9 * intensity),
    fretHeight: markerSize * range(random, 0.7, 0.95),
    halfLength: markerSize * (1.8 + 1 * intensity),
    amplitude: markerSize * (0.5 + 0.3 * intensity) * range(random, 0.9, 1.1),
    wobble,
    rise: markerSize * RISE,
    tilt: -sign * range(random, 2, 6),
    glow: 18 + 18 * intensity,
    comboTilt: sign * range(random, 6, 14),
  }
}

/** Un trait de lumière : la corde s'allume, une tête brillante file devant. */
function Streak({
  side,
  pluck,
  color,
  highlight,
  className,
}: {
  side: Side
  pluck: Pluck
  color: string
  highlight: string
  className?: string
}) {
  const { thickness, headLength, fretHeight } = pluck
  return (
    <div data-slot="reveal-streak" className={cn('absolute top-0 left-0 size-0', className)}>
      <motion.div
        data-slot="reveal-streak-trail"
        className="absolute left-0 rounded-full"
        style={{
          width: side.travel,
          height: thickness,
          top: -thickness / 2,
          originX: 0,
          background: `linear-gradient(to right, ${color}, transparent)`,
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 0.9, 0.6, 0] }}
        transition={{
          delay: side.delay,
          duration: side.duration,
          ease: ease.outExpo,
          opacity: {
            delay: side.delay,
            duration: side.duration + 0.1,
            times: [0, 0.05, 0.45, 1],
            ease: 'linear',
          },
        }}
      />
      {/* Les fils de frette s'allument au passage de la tête. */}
      {side.frets.map((fret) => (
        <motion.div
          key={fret.at}
          data-slot="reveal-fret-flash"
          className="absolute rounded-full"
          style={{
            left: fret.at - 1,
            top: -fretHeight / 2,
            width: 2,
            height: fretHeight,
            background: highlight,
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: [0, 1.15, 0.5], opacity: [0, 1, 0] }}
          transition={{
            delay: fret.delay,
            duration: duration.base,
            times: [0, 0.2, 1],
            ease: [ease.outQuart, ease.outQuart],
          }}
        />
      ))}
      <motion.div
        data-slot="reveal-streak-head"
        className="absolute rounded-full"
        style={{
          width: headLength,
          height: thickness * 1.6,
          left: -headLength,
          top: (-thickness * 1.6) / 2,
          background: `linear-gradient(to right, transparent, ${color} 45%, ${highlight})`,
          boxShadow: `6px 0 10px -2px ${color}`,
        }}
        initial={{ x: 0, opacity: 0 }}
        animate={{ x: side.travel, opacity: [0, 1, 1, 0] }}
        transition={{
          delay: side.delay,
          duration: side.duration,
          ease: ease.outExpo,
          opacity: {
            delay: side.delay,
            duration: side.duration,
            times: [0, 0.06, 0.5, 1],
            ease: 'linear',
          },
        }}
      />
    </div>
  )
}

function StringPluck({
  label,
  x,
  y,
  markerSize,
  pxPerMm,
  stringAngle,
  fretOffsets,
  intensity,
  streak,
  seed,
  budgetMs,
  color,
  colorForeground,
  highlight,
  onComplete,
}: RevealEffectProps) {
  const gradientId = useId()
  // Sortie calée sur la note suivante : l'étiquette s'efface juste avant son apparition.
  const exit = useMemo(() => revealExit(budgetMs), [budgetMs])
  useCompleteAfter(exit.lifetimeMs, onComplete)
  const pluck = useMemo(
    () => buildPluck(seed, intensity, markerSize, pxPerMm, stringAngle, fretOffsets, label),
    [seed, intensity, markerSize, pxPerMm, stringAngle, fretOffsets, label],
  )
  const { fontSize, halfLength: s, amplitude: a, wobble } = pluck
  const comboScale = comboScaleFor(streak)

  return (
    <RevealRoot
      x={x}
      y={y}
      effect="string-pluck"
      animate={{ opacity: [1, 1, 0] }}
      transition={exit.transition}
    >
      {/* Tout ce qui épouse la corde vit dans ce repère tourné ; la racine, elle, ne tourne pas. */}
      <div
        data-slot="reveal-string"
        className="absolute top-0 left-0 size-0"
        style={{ rotate: `${pluck.angle}deg` }}
      >
        {/* Éclair allongé le long de la corde, au relâchement. */}
        <motion.div
          data-slot="reveal-flash"
          className={REVEAL_CENTERED}
          style={{
            width: markerSize * 4,
            height: markerSize * 1.5,
            background: `radial-gradient(closest-side, ${highlight}, transparent)`,
          }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.3], opacity: [0, 0.85, 0] }}
          transition={{
            delay: PLUCK,
            duration: duration.fast + 0.06,
            times: [0, 0.15, 1],
            ease: [ease.outQuart, ease.outQuart],
          }}
        />

        <Streak side={pluck.sides[0]} pluck={pluck} color={color} highlight={highlight} />
        <Streak
          side={pluck.sides[1]}
          pluck={pluck}
          color={color}
          highlight={highlight}
          className="rotate-180"
        />

        {/* Segment qui vibre : un arc dont l'échelle verticale oscille (mode fondamental). */}
        <svg
          data-slot="reveal-vibration"
          className="absolute overflow-visible"
          style={{ left: -s, top: -2 * a }}
          width={2 * s}
          height={4 * a}
          viewBox={`${-s} ${-2 * a} ${2 * s} ${4 * a}`}
          fill="none"
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={-s}
              y1={0}
              x2={s}
              y2={0}
            >
              <stop offset="0" style={{ stopColor: color, stopOpacity: 0 }} />
              {/* oklab : en oklch, la teinte nulle du blanc ferait virer le mélange au jaune. */}
              <stop
                offset="0.5"
                style={{ stopColor: `color-mix(in oklab, ${color} 55%, ${highlight})` }}
              />
              <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <motion.g
            style={SVG_AXIS_ORIGIN}
            initial={{ scaleY: wobble[0], opacity: 0 }}
            animate={{ scaleY: wobble, opacity: [0, 1, 1, 0] }}
            transition={{
              delay: PLUCK,
              duration: VIBRATION,
              ease: ease.inOut,
              opacity: {
                delay: PLUCK,
                duration: VIBRATION + 0.2,
                times: [0, 0.06, 0.6, 1],
                ease: 'linear',
              },
            }}
          >
            <path
              d={`M ${-s} 0 Q 0 ${2 * a} ${s} 0`}
              stroke={`url(#${gradientId})`}
              strokeWidth={pluck.thickness * 3.5}
              strokeOpacity={0.35}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M ${-s} 0 Q 0 ${2 * a} ${s} 0`}
              stroke={`url(#${gradientId})`}
              strokeWidth={pluck.thickness}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </motion.g>
        </svg>
      </div>

      {/* Étiquette : éclot du point et s'élève un peu, sans quitter sa corde. */}
      <motion.div
        data-slot="reveal-label"
        className={cn(REVEAL_CENTERED, 'w-max')}
        style={{ fontSize }}
        initial={{ y: 0 }}
        animate={{ y: -pluck.rise }}
        transition={{ delay: PLUCK * 0.5, duration: 0.34, ease: ease.outExpo }}
      >
        <motion.span
          data-slot="reveal-label-pill"
          className={REVEAL_PILL}
          style={revealPillStyle(color, colorForeground, pluck.glow)}
          initial={{ scaleX: pluck.fromX, scaleY: pluck.fromY, rotate: pluck.tilt }}
          animate={{ scaleX: 1, scaleY: 1, rotate: 0 }}
          transition={{ delay: PLUCK * 0.5, duration: 0.24, ease: ease.outBack }}
        >
          <motion.span
            className="block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: PLUCK + 0.015, duration: duration.instant }}
          >
            {label}
          </motion.span>
        </motion.span>

        <RevealCombo
          streak={streak}
          color={color}
          colorForeground={colorForeground}
          className="-translate-x-[35%] -translate-y-[62%]"
          // Ancré en bas à gauche : le badge grossit en s'éloignant de l'étiquette.
          style={{ originX: 0.1, originY: 0.9 }}
          initial={{ scale: 0, y: 8, rotate: 0, opacity: 0 }}
          animate={{
            scale: [0, comboScale * 1.25, comboScale],
            y: 0,
            rotate: pluck.comboTilt,
            opacity: 1,
          }}
          transition={{
            delay: PLUCK + 0.08,
            duration: 0.24,
            times: [0, 0.45, 1],
            ease: [ease.outQuart, ease.outBack],
            y: { delay: PLUCK + 0.08, duration: 0.24, ease: ease.outExpo },
            rotate: { delay: PLUCK + 0.08, duration: 0.24, ease: ease.outBack },
            opacity: { delay: PLUCK + 0.08, duration: 0.05, ease: 'linear' },
          }}
        />
      </motion.div>

      {/* Le point d'origine, au-dessus de tout : écrasé sur la corde par le doigt, puis absorbé. */}
      <div className="absolute top-0 left-0 size-0" style={{ rotate: `${pluck.angle}deg` }}>
        <motion.div
          data-slot="reveal-origin"
          className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
          style={{ width: markerSize, height: markerSize }}
          initial={{ scaleX: 1, scaleY: 1, opacity: 1 }}
          animate={{ scaleX: [1, 1.5, 2.4], scaleY: [1, 0.55, 0.15], opacity: [1, 1, 0] }}
          transition={{
            duration: PLUCK + 0.08,
            times: [0, PLUCK / (PLUCK + 0.08), 1],
            ease: [ease.outQuart, ease.outExpo],
          }}
        />
      </div>
    </RevealRoot>
  )
}

export const stringPluckEffect: RevealEffect = {
  id: 'string-pluck',
  name: 'Corde pincée',
  outcomes: ['correct'],
  Component: StringPluck,
}
