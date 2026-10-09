import { useMemo } from 'react'
import { motion, type Transition } from 'motion/react'

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
 * « Onde de choc » : le point gonfle et se mue en étiquette, flash blanc au
 * cœur, deux ondes de choc qui s'amincissent et des traits de vitesse.
 * Tout grossit avec l'intensité de la série.
 */

const SVG_CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface SpeedLine {
  /** Direction (deg). */
  angle: number
  /** Distances au centre (px) au départ et à l'arrivée de la pointe. */
  from: number
  to: number
  length: number
  thickness: number
  delay: number
  /** Trait « chauffé à blanc » plutôt que coloré. */
  hot: boolean
}

interface Shockwave {
  diameter: number
  delay: number
  stroke: number
}

interface Burst {
  fontSize: number
  lines: SpeedLine[]
  waves: Shockwave[]
  /** Échelle de départ de l'étiquette : la taille du point. */
  fromX: number
  fromY: number
  pop: Transition
  glow: number
  flash: number
}

function buildBurst(seed: number, intensity: number, markerSize: number, label: string): Burst {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  const { halfW, halfH } = estimateLabelBox(fontSize, label)

  const count = Math.min(10, Math.max(4, Math.round(4 + 6 * intensity + range(random, -0.5, 0.5))))
  const turn = random() * Math.PI * 2
  const lines = Array.from({ length: count }, (_, i): SpeedLine => {
    const theta = turn + ((i + range(random, -0.3, 0.3)) / count) * Math.PI * 2
    // Rayon polaire de l'ellipse inscrite dans l'étiquette.
    const edge = (halfW * halfH) / Math.hypot(halfH * Math.cos(theta), halfW * Math.sin(theta))
    return {
      angle: (theta * 180) / Math.PI,
      from: edge + markerSize * 0.1,
      to: edge + markerSize * range(random, 0.85, 1.25) * (1 + intensity),
      length: markerSize * range(random, 0.4, 0.7) * (1 + 0.8 * intensity),
      thickness: range(random, 2, 3) + intensity,
      delay: range(random, 0.015, 0.05),
      hot: random() < 0.3 + 0.3 * intensity,
    }
  })

  const outer = markerSize * (4 + 3 * intensity) * range(random, 0.92, 1.08)
  const waves: Shockwave[] = [
    { diameter: outer, delay: 0.02, stroke: 3 + 2 * intensity },
    { diameter: outer * range(random, 0.58, 0.7), delay: 0.07, stroke: 2 + intensity },
  ]

  return {
    fontSize,
    lines,
    waves,
    fromX: (markerSize * 0.9) / (2 * halfW),
    fromY: (markerSize * 0.9) / (2 * halfH),
    // Ressort très raide : taille finale vers 50 ms, dépassement qui croît avec la série.
    pop: { type: 'spring', stiffness: 1100, damping: 26 - 7 * intensity, mass: 0.6 },
    glow: 18 + 18 * intensity,
    flash: 1.2 + 0.6 * intensity,
  }
}

function ImpactRing({
  label,
  x,
  y,
  markerSize,
  intensity,
  streak,
  seed,
  budgetMs,
  color,
  colorForeground,
  highlight,
  onComplete,
}: RevealEffectProps) {
  // Sortie calée sur la note suivante : l'étiquette s'efface juste avant son apparition.
  const exit = useMemo(() => revealExit(budgetMs), [budgetMs])
  useCompleteAfter(exit.lifetimeMs, onComplete)
  const burst = useMemo(
    () => buildBurst(seed, intensity, markerSize, label),
    [seed, intensity, markerSize, label],
  )
  const { fontSize, lines, waves } = burst
  const outer = waves[0].diameter

  return (
    <RevealRoot
      x={x}
      y={y}
      effect="impact-ring"
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.94] }}
      transition={exit.transition}
    >
      {/* Flash de cœur, sous l'étiquette pour ne pas gêner la lecture. */}
      <motion.div
        data-slot="reveal-flash"
        className={cn(REVEAL_CENTERED, 'rounded-full')}
        style={{
          width: markerSize * 2.6,
          height: markerSize * 2.6,
          background: `radial-gradient(closest-side, ${highlight}, transparent)`,
        }}
        initial={{ scale: 0.4, opacity: 1 }}
        animate={{ scale: burst.flash, opacity: 0 }}
        transition={{ duration: duration.fast + 0.06, ease: ease.outQuart }}
      />

      {/* Ondes de choc : un trait épais qui s'éteint vite + un trait fin qui persiste,
          l'onde semble s'amincir en s'élargissant. */}
      <svg
        data-slot="reveal-shockwaves"
        className={cn(REVEAL_CENTERED, 'overflow-visible')}
        width={outer}
        height={outer}
        viewBox={`${-outer / 2} ${-outer / 2} ${outer} ${outer}`}
        fill="none"
      >
        {waves.map((wave) => (
          <motion.g
            key={wave.delay}
            style={SVG_CENTERED}
            initial={{ scale: markerSize / wave.diameter }}
            animate={{ scale: 1 }}
            transition={{ delay: wave.delay, duration: 0.45, ease: ease.outExpo }}
          >
            <motion.circle
              r={wave.diameter / 2}
              vectorEffect="non-scaling-stroke"
              strokeWidth={wave.stroke}
              style={{ stroke: color }}
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 0 }}
              transition={{ delay: wave.delay, duration: 0.16, ease: ease.outQuart }}
            />
            <motion.circle
              r={wave.diameter / 2}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.25}
              style={{ stroke: color }}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: [0.9, 0.55, 0] }}
              transition={{ delay: wave.delay, duration: 0.3, times: [0, 0.45, 1], ease: 'linear' }}
            />
          </motion.g>
        ))}
      </svg>

      {/* Traits de vitesse : la pointe file, la queue la rattrape. */}
      {lines.map((line) => (
        <div
          key={line.angle}
          className="absolute top-0 left-0 size-0"
          style={{ rotate: `${line.angle}deg` }}
        >
          <motion.div
            data-slot="reveal-speed-line"
            className="absolute left-0 rounded-full"
            style={{
              width: line.length,
              height: line.thickness,
              top: -line.thickness / 2,
              originX: 1,
              background: line.hot ? highlight : color,
            }}
            initial={{ x: line.from, scaleX: 0.4, opacity: 0 }}
            animate={{ x: line.to, scaleX: [0.4, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{
              delay: line.delay,
              duration: 0.3,
              ease: ease.outExpo,
              scaleX: {
                delay: line.delay,
                duration: 0.3,
                times: [0, 0.25, 1],
                ease: [ease.outQuart, ease.inQuad],
              },
              opacity: {
                delay: line.delay,
                duration: 0.3,
                times: [0, 0.08, 0.6, 1],
                ease: 'linear',
              },
            }}
          />
        </div>
      ))}

      {/* Étiquette : naît à la taille du point puis s'étire avec dépassement. */}
      <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
        <motion.span
          data-slot="reveal-label-pill"
          className={REVEAL_PILL}
          style={revealPillStyle(color, colorForeground, burst.glow)}
          initial={{ scaleX: burst.fromX, scaleY: burst.fromY }}
          animate={{ scaleX: 1, scaleY: 1 }}
          transition={burst.pop}
        >
          <motion.span
            className="block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.03, duration: duration.instant }}
          >
            {label}
          </motion.span>
        </motion.span>

        <RevealCombo
          streak={streak}
          color={color}
          colorForeground={colorForeground}
          className="-translate-x-[55%] -translate-y-[60%]"
          initial={{ scale: 0, rotate: -40, opacity: 0 }}
          animate={{ scale: comboScaleFor(streak), rotate: -10, opacity: 1 }}
          transition={{ ...burst.pop, delay: 0.06 }}
        />
      </div>

      {/* Le point d'origine : il gonfle, blanchit et s'efface sur l'étiquette naissante. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{
          scale: { duration: 0.14, ease: ease.outExpo },
          opacity: { duration: 0.09, ease: 'linear' },
        }}
      />
    </RevealRoot>
  )
}

export const impactRingEffect: RevealEffect = {
  id: 'impact-ring',
  name: 'Onde de choc',
  outcomes: ['correct'],
  Component: ImpactRing,
}
