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
import { range, seededRandom } from '../random'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Gerbe d'étincelles » : le point se contracte puis éclate en une gerbe de
 * particules qui filent en décélérant, rétrécissent et s'éteignent ; quelques
 * étoiles blanches scintillent en bout de course. L'étiquette jaillit du point.
 * Le nombre de particules (10 → 28), leur portée et le dépassement montent avec la série.
 */

/** Durée de vie (ms) : la traîne chevauche la note suivante (affichée ~420 ms après). */
const LIFETIME_MS = 780
/** Contraction du point avant l'éclatement (s). */
const WINDUP = 0.03
/** Début et durée (s) du fondu de sortie global. */
const FADE_AT = 0.44
const FADE_FOR = 0.28
const EXIT: Transition = {
  duration: FADE_AT + FADE_FOR,
  times: [0, FADE_AT / (FADE_AT + FADE_FOR), 1],
  // Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la timeline.
  ease: ['linear', ease.outQuart],
}

/** Mouvement réduit : apparition, maintien, disparition. */
const REDUCED_EASE: Easing[] = [ease.outQuart, 'linear', ease.inQuad]

/** Étoile à quatre branches. */
const STAR_CLIP = 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)'

type ParticleKind = 'spark' | 'ember' | 'star'

interface Particle {
  kind: ParticleKind
  /** Départ et arrivée (px, relatifs au centre du point). */
  fromX: number
  fromY: number
  toX: number
  toY: number
  width: number
  height: number
  /** Orientation (deg) au départ et à l'arrivée : les étoiles tournoient. */
  rotate: number
  spin: number
  delay: number
  duration: number
}

interface Spray {
  fontSize: number
  particles: Particle[]
  /** Échelle de départ de l'étiquette : la taille du point. */
  fromX: number
  fromY: number
  tilt: number
  pop: Transition
  glow: number
  flash: number
  comboTilt: number
}

function buildSpray(seed: number, intensity: number, markerSize: number, label: string): Spray {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  // Demi-axes estimés de l'étiquette (hauteur exacte : 1em + 2 × 0.38em).
  const halfW = (fontSize * (0.62 * [...label].length + 1.4)) / 2
  const halfH = (fontSize * 1.76) / 2

  const count = Math.round(10 + 18 * intensity)
  const stars = Math.round(2 + 3 * intensity + range(random, -0.4, 0.4))
  const starEvery = count / stars
  const starOffset = random() * starEvery
  const turn = random() * Math.PI * 2
  const reach = markerSize * (1 + 0.8 * intensity)

  const particles = Array.from({ length: count }, (_, i): Particle => {
    const theta = turn + ((i + range(random, -0.35, 0.35)) / count) * Math.PI * 2
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const isStar =
      Math.floor((i + starOffset) / starEvery) !== Math.floor((i + starOffset + 1) / starEvery)
    const kind: ParticleKind = isStar ? 'star' : random() < 0.6 ? 'spark' : 'ember'
    const start = markerSize * 0.2
    const distance = reach * (isStar ? range(random, 1.5, 2.4) : range(random, 1.3, 3.1))
    const size = range(random, 2.5, 4.5) + 1.5 * intensity
    const starSize = markerSize * range(random, 0.5, 0.75) * (1 + 0.3 * intensity)
    return {
      kind,
      fromX: start * cos,
      fromY: start * sin,
      toX: distance * cos,
      toY: distance * sin,
      width: isStar ? starSize : kind === 'spark' ? size * range(random, 2.4, 3.6) : size * 1.1,
      height: isStar ? starSize : kind === 'spark' ? size : size * 1.1,
      rotate: isStar ? random() * 45 : (theta * 180) / Math.PI,
      spin: (random() < 0.5 ? -1 : 1) * range(random, 120, 240),
      delay: WINDUP + range(random, 0, 0.03),
      duration: isStar ? range(random, 0.5, 0.6) : range(random, 0.34, 0.5),
    }
  })

  return {
    fontSize,
    particles,
    fromX: (markerSize * 0.9) / (2 * halfW),
    fromY: (markerSize * 0.9) / (2 * halfH),
    tilt: (random() < 0.5 ? -1 : 1) * range(random, 4, 9),
    // Pop « outBack » dont le dépassement grandit avec la série.
    pop: {
      delay: WINDUP * 0.5,
      duration: 0.24,
      ease: [ease.outBack[0], ease.outBack[1] + 0.7 * intensity, ease.outBack[2], ease.outBack[3]],
    },
    glow: 18 + 18 * intensity,
    flash: 1.3 + 0.8 * intensity,
    comboTilt: (random() < 0.5 ? -1 : 1) * range(random, 6, 14),
  }
}

function particleMotion(p: Particle, color: string) {
  if (p.kind === 'star') {
    return {
      style: { width: p.width, height: p.height, background: 'var(--marker)', clipPath: STAR_CLIP },
      initial: { x: p.fromX, y: p.fromY, rotate: p.rotate, scale: 0.3, opacity: 0 },
      // Scintillement en bout de course : rebond d'échelle avant extinction.
      animate: {
        x: p.toX,
        y: p.toY,
        rotate: p.rotate + p.spin,
        scale: [0.3, 1.1, 0.55, 1.2, 0],
        opacity: [0, 1, 1, 0],
      },
      transition: {
        delay: p.delay,
        duration: p.duration,
        ease: ease.outExpo,
        rotate: { delay: p.delay, duration: p.duration, ease: ease.outQuart },
        scale: {
          delay: p.delay,
          duration: p.duration,
          times: [0, 0.18, 0.5, 0.7, 1],
          ease: [ease.outQuart, ease.outQuart, ease.outQuart, ease.inQuad],
        },
        opacity: {
          delay: p.delay,
          duration: p.duration,
          times: [0, 0.04, 0.85, 1],
          ease: 'linear',
        },
      } satisfies Transition,
    }
  }
  return {
    style: {
      width: p.width,
      height: p.height,
      background: color,
      boxShadow: `0 0 6px ${color}`,
    },
    initial: { x: p.fromX, y: p.fromY, rotate: p.rotate, scale: 1, opacity: 0 },
    animate: { x: p.toX, y: p.toY, scale: 0, opacity: [0, 1, 1, 0] },
    transition: {
      delay: p.delay,
      duration: p.duration,
      ease: ease.outExpo,
      // L'étincelle garde sa taille pendant la course puis se consume.
      scale: { delay: p.delay, duration: p.duration, ease: ease.inQuad },
      opacity: { delay: p.delay, duration: p.duration, times: [0, 0.04, 0.7, 1], ease: 'linear' },
    } satisfies Transition,
  }
}

// oxlint-disable-next-line react/only-export-components -- exporté via son descripteur d'effet
function SparkBurst({
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
  const spray = useMemo(
    () => buildSpray(seed, intensity, markerSize, label),
    [seed, intensity, markerSize, label],
  )
  const { fontSize } = spray
  const pillStyle = {
    background: color,
    color: colorForeground,
    boxShadow: `0 0 ${spray.glow}px color-mix(in oklch, ${color} 55%, transparent)`,
  }

  if (reduceMotion) {
    return (
      <motion.div
        data-slot="reveal-effect"
        data-effect="spark-burst"
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
      data-effect="spark-burst"
      className="pointer-events-none absolute size-0 overflow-visible"
      style={{ left: x, top: y }}
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.95] }}
      transition={EXIT}
    >
      {/* Éclair d'impact au moment de l'éclatement. */}
      <motion.div
        data-slot="reveal-flash"
        className={cn(REVEAL_CENTERED, 'rounded-full')}
        style={{
          width: markerSize * 2.8,
          height: markerSize * 2.8,
          background: 'radial-gradient(closest-side, var(--marker), transparent)',
        }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, spray.flash], opacity: [0, 1, 0] }}
        transition={{
          delay: WINDUP,
          duration: duration.fast + 0.06,
          times: [0, 0.15, 1],
          ease: [ease.outQuart, ease.outQuart],
        }}
      />

      {/* La gerbe : étincelles et braises colorées, étoiles blanches. */}
      {spray.particles.map((p, i) => {
        const { style, initial, animate, transition } = particleMotion(p, color)
        return (
          <motion.span
            key={i}
            data-slot={p.kind === 'star' ? 'reveal-sparkle' : 'reveal-particle'}
            className={cn(REVEAL_CENTERED, 'block', p.kind !== 'star' && 'rounded-full')}
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          />
        )
      })}

      {/* Étiquette : jaillit du point avec dépassement. */}
      <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
        <motion.span
          data-slot="reveal-label-pill"
          className={REVEAL_PILL}
          style={pillStyle}
          initial={{ scaleX: spray.fromX, scaleY: spray.fromY, rotate: spray.tilt }}
          animate={{ scaleX: 1, scaleY: 1, rotate: 0 }}
          transition={spray.pop}
        >
          <motion.span
            className="block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: WINDUP + 0.02, duration: duration.instant }}
          >
            {label}
          </motion.span>
        </motion.span>

        {streak >= COMBO_MIN_STREAK && (
          <motion.span
            data-slot="reveal-combo"
            className={cn(REVEAL_COMBO, '-translate-x-[35%] -translate-y-[62%]')}
            // Ancré en bas à gauche : le badge grossit en s'éloignant de l'étiquette.
            style={{
              background: colorForeground,
              color,
              boxShadow: `0 0 0 1.5px ${color}`,
              originX: 0.1,
              originY: 0.9,
            }}
            initial={{ scale: 0, rotate: -spray.comboTilt * 3, opacity: 0 }}
            animate={{
              scale: [0, comboScale * 1.3, comboScale],
              rotate: spray.comboTilt,
              opacity: 1,
            }}
            transition={{
              delay: WINDUP + 0.07,
              duration: 0.22,
              times: [0, 0.45, 1],
              ease: [ease.outQuart, ease.outBack],
              rotate: { delay: WINDUP + 0.07, duration: 0.22, ease: ease.outBack },
              opacity: { delay: WINDUP + 0.07, duration: 0.05, ease: 'linear' },
            }}
          >
            ×{streak}
          </motion.span>
        )}
      </div>

      {/* Le point d'origine : se contracte puis éclate et s'efface. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: [1, 0.72, 1.8], opacity: [1, 1, 0] }}
        transition={{
          duration: WINDUP + 0.1,
          times: [0, WINDUP / (WINDUP + 0.1), 1],
          ease: [ease.outQuart, ease.outExpo],
        }}
      />
    </motion.div>
  )
}

export const sparkBurstEffect: RevealEffect = {
  id: 'spark-burst',
  name: "Gerbe d'étincelles",
  outcomes: ['correct'],
  Component: SparkBurst,
}
