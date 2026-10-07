import { useMemo } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Easing,
  type Transition,
} from 'motion/react'

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
 * « Tampon » : le point se tasse (anticipation), puis l'étiquette s'abat depuis
 * une grande échelle, légèrement de biais, et frappe le manche : écrasement,
 * anneau d'impact, éclats de poussière et micro-secousse.
 */

/** Anticipation (s) : le point se tasse avant la frappe. */
const WINDUP = 0.04
/** Chute (s) : de l'échelle de départ jusqu'au contact. */
const DROP = 0.07
/** Instant du contact (s). */
const IMPACT = WINDUP + DROP
/** Durée totale de l'atterrissage (chute + rebonds), en s. */
const LANDING = 0.26
/** Durée de vie (ms) : la traîne chevauche la note suivante, affichée ~420 ms après. */
const LIFETIME_MS = 760
/** Début et durée (s) du fondu de sortie global : l'essentiel de l'opacité part dès le début. */
const FADE_AT = 0.42
const FADE_FOR = 0.28
const EXIT: Transition = {
  duration: FADE_AT + FADE_FOR,
  times: [0, FADE_AT / (FADE_AT + FADE_FOR), 1],
  // Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la
  // timeline quand Motion délègue l'opacité à WAAPI.
  ease: ['linear', ease.outQuart],
}
/** Chute accélérée, contact, rebond, repos. */
const SLAM: Transition = {
  delay: WINDUP,
  duration: LANDING,
  times: [0, DROP / LANDING, 0.62, 1],
  ease: [ease.inQuad, ease.outQuart, ease.outQuart],
}

/** Mouvement réduit : apparition, maintien, disparition. */
const REDUCED_EASE: Easing[] = [ease.outQuart, 'linear', ease.inQuad]

const SVG_CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface DustTick {
  /** Point d'ancrage sur le bord de l'étiquette (% de sa boîte). */
  left: number
  top: number
  /** Direction de la normale au bord (deg). */
  angle: number
  length: number
  thickness: number
  travel: number
  delay: number
  hot: boolean
}

interface Stamp {
  fontSize: number
  /** Échelle de départ de la frappe. */
  from: number
  tilt: number
  rest: number
  ticks: DustTick[]
  /** Rayon des bouts de l'étiquette (px), pour que l'anneau d'impact en épouse la forme. */
  radius: number
  ring: { scale: number; stroke: number }
  shake: { x: number[]; y: number[] }
  glow: number
  comboTilt: number
}

function buildStamp(seed: number, intensity: number, markerSize: number, label: string): Stamp {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  // Demi-axes estimés de l'étiquette (hauteur exacte : 1em + 2 × 0.38em).
  const halfW = (fontSize * (0.62 * [...label].length + 1.4)) / 2
  const halfH = (fontSize * 1.76) / 2
  const sign = random() < 0.5 ? -1 : 1

  const count = Math.min(12, Math.max(6, Math.round(6 + 6 * intensity + range(random, -0.5, 0.5))))
  const turn = random() * Math.PI * 2
  const ticks = Array.from({ length: count }, (_, i): DustTick => {
    // Paramètre sur l'ellipse inscrite : en %, la position épouse la vraie largeur de l'étiquette.
    const phi = turn + ((i + range(random, -0.3, 0.3)) / count) * Math.PI * 2
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    return {
      left: 50 + 50 * cos,
      top: 50 + 50 * sin,
      angle: (Math.atan2(halfW * sin, halfH * cos) * 180) / Math.PI,
      length: markerSize * range(random, 0.3, 0.5) * (1 + 0.5 * intensity),
      thickness: range(random, 2, 3) + intensity,
      travel: markerSize * range(random, 0.8, 1.3) * (1 + 0.8 * intensity),
      delay: IMPACT + range(random, 0, 0.025),
      hot: random() < 0.3,
    }
  })

  // Micro-secousse amortie, 2 à 3 px, dans une direction tirée au sort.
  const amp = 2 + intensity
  const dir = random() * Math.PI * 2
  const decay = [0, 1, -0.6, 0.3, 0]
  const gap = markerSize * (0.9 + 0.8 * intensity)

  return {
    fontSize,
    from: 2.6 + 0.8 * intensity,
    tilt: sign * range(random, 4, 8),
    rest: sign * range(random, 0.6, 2),
    ticks,
    radius: halfH,
    // Échelle uniforme : l'anneau reste un écho fidèle de la forme du tampon.
    ring: { scale: 1 + (0.75 * gap) / halfH, stroke: 3 + 2 * intensity },
    shake: {
      x: decay.map((k) => k * amp * Math.cos(dir)),
      y: decay.map((k) => k * amp * Math.sin(dir)),
    },
    glow: 18 + 18 * intensity,
    comboTilt: -sign * range(random, 6, 14),
  }
}

// oxlint-disable-next-line react/only-export-components -- exporté via son descripteur d'effet
function StampSlam({
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
  const stamp = useMemo(
    () => buildStamp(seed, intensity, markerSize, label),
    [seed, intensity, markerSize, label],
  )
  const { fontSize, from, tilt, rest } = stamp
  // Opacité indexée sur l'échelle (et non sur le temps) : fantôme tant qu'il est grand,
  // plein au contact, quel que soit le décalage de démarrage entre JS et WAAPI.
  const slamX = useMotionValue(from)
  const ghost = useTransform(slamX, [from, (from + 1.12) / 2, 1.12], [0, 0.35, 1])
  const pillStyle = {
    background: color,
    color: colorForeground,
    boxShadow: `0 0 ${stamp.glow}px color-mix(in oklch, ${color} 55%, transparent)`,
  }

  if (reduceMotion) {
    return (
      <motion.div
        data-slot="reveal-effect"
        data-effect="stamp-slam"
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

  return (
    <motion.div
      data-slot="reveal-effect"
      data-effect="stamp-slam"
      className="pointer-events-none absolute size-0 overflow-visible"
      style={{ left: x, top: y }}
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.95] }}
      transition={EXIT}
    >
      {/* Le point d'origine se tasse puis s'efface sous le tampon. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: [1, 0.8, 0.6], opacity: [1, 1, 0] }}
        transition={{
          duration: IMPACT,
          times: [0, WINDUP / IMPACT, 1],
          ease: [ease.outQuart, ease.inQuad],
        }}
      />

      {/* Éclair de contact, derrière l'étiquette. */}
      <motion.div
        data-slot="reveal-flash"
        className={REVEAL_CENTERED}
        style={{
          width: markerSize * 5,
          height: markerSize * 3,
          background: 'radial-gradient(closest-side, var(--marker), transparent)',
        }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.35], opacity: [0, 0.6 + 0.3 * intensity, 0] }}
        transition={{
          delay: IMPACT - 0.01,
          duration: duration.base,
          times: [0, 0.12, 1],
          ease: [ease.outQuart, ease.outQuart],
        }}
      />

      <motion.div
        data-slot="reveal-shake"
        className="absolute top-0 left-0 size-0"
        animate={{ x: stamp.shake.x, y: stamp.shake.y }}
        transition={{ delay: IMPACT, duration: 0.15, ease: 'linear' }}
      >
        <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
          {/* Anneau d'impact : épouse la forme de l'étiquette ; trait épais qui s'éteint vite
              + trait fin qui persiste = l'onde s'amincit en s'élargissant. */}
          <svg
            data-slot="reveal-impact-ring"
            className="absolute inset-0 size-full overflow-visible"
            fill="none"
          >
            <motion.g
              style={SVG_CENTERED}
              animate={{ scale: stamp.ring.scale }}
              transition={{ delay: IMPACT, duration: 0.4, ease: ease.outExpo }}
            >
              {[stamp.ring.stroke, 1.5].map((stroke, i) => (
                <motion.rect
                  key={i}
                  width="100%"
                  height="100%"
                  rx={stamp.radius}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={stroke}
                  style={{ stroke: color }}
                  initial={{ opacity: 0 }}
                  // Premier keyframe à 0 : WAAPI l'affiche pendant le délai.
                  animate={{ opacity: [0, 0.95, 0] }}
                  transition={{
                    delay: IMPACT,
                    duration: i === 0 ? 0.14 : 0.26,
                    times: [0, 0.04, 1],
                    ease: ['linear', i === 0 ? ease.outQuart : 'linear'],
                  }}
                />
              ))}
            </motion.g>
          </svg>

          {/* Éclats de poussière, projetés depuis les bords. */}
          {stamp.ticks.map((tick) => (
            <span
              key={tick.angle}
              className="absolute size-0"
              style={{ left: `${tick.left}%`, top: `${tick.top}%`, rotate: `${tick.angle}deg` }}
            >
              <motion.span
                data-slot="reveal-dust"
                className="absolute left-0 rounded-full"
                style={{
                  width: tick.length,
                  height: tick.thickness,
                  top: -tick.thickness / 2,
                  originX: 1,
                  background: tick.hot ? 'var(--marker)' : color,
                }}
                initial={{ x: markerSize * 0.06, scaleX: 0.3, opacity: 0 }}
                animate={{ x: tick.travel, scaleX: [0.3, 1, 0], opacity: [0, 1, 1, 0] }}
                transition={{
                  delay: tick.delay,
                  duration: 0.28,
                  ease: ease.outQuart,
                  scaleX: {
                    delay: tick.delay,
                    duration: 0.28,
                    times: [0, 0.2, 1],
                    ease: [ease.outQuart, ease.inQuad],
                  },
                  opacity: {
                    delay: tick.delay,
                    duration: 0.28,
                    times: [0, 0.05, 0.3, 1],
                    ease: 'linear',
                  },
                }}
              />
            </span>
          ))}

          {/* Le tampon : chute accélérée, écrasement au contact, rebond, repos. */}
          <motion.span
            data-slot="reveal-label-pill"
            className={REVEAL_PILL}
            style={{ ...pillStyle, scaleX: slamX, opacity: ghost }}
            initial={{ scaleY: from, rotate: tilt }}
            animate={{
              scaleX: [from, 1.12, 0.96, 1],
              scaleY: [from, 0.8, 1.07, 1],
              rotate: [tilt, rest, rest, rest],
            }}
            transition={SLAM}
          >
            {label}
          </motion.span>

          {streak >= COMBO_MIN_STREAK && (
            <motion.span
              data-slot="reveal-combo"
              className={cn(REVEAL_COMBO, '-translate-x-[55%] -translate-y-[60%]')}
              style={{ background: colorForeground, color, boxShadow: `0 0 0 1.5px ${color}` }}
              initial={{ scale: 2.4, rotate: stamp.comboTilt * 2, opacity: 0 }}
              animate={{
                scale: [2.4, comboScale * 0.9, comboScale],
                rotate: stamp.comboTilt,
                opacity: [0, 1, 1],
              }}
              transition={{
                delay: IMPACT + 0.08,
                duration: 0.2,
                times: [0, 0.4, 1],
                ease: [ease.inQuad, ease.outBack],
                rotate: { delay: IMPACT + 0.08, duration: 0.08, ease: ease.inQuad },
              }}
            >
              ×{streak}
            </motion.span>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export const stampSlamEffect: RevealEffect = {
  id: 'stamp-slam',
  name: 'Tampon',
  outcomes: ['correct'],
  Component: StampSlam,
}
