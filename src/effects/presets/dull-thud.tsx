import { useMemo } from 'react'
import { motion, type Transition } from 'motion/react'

import { cn } from '@/lib/utils'
import { range, seededRandom } from '@/lib/random'
import { ease } from '@/theme/motion'
import {
  REVEAL_CENTERED,
  REVEAL_PILL,
  RevealRoot,
  estimateLabelBox,
  labelFontSize,
  revealExit,
  revealPillStyle,
  useCompleteAfter,
} from '../kit'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Coup sourd » (erreur) : le point se soulève en s'étirant (anticipation),
 * retombe lourdement et s'écrase sur le manche. Au contact, un enfoncement
 * sombre et une onde rouge éteinte filent au ras du bois ; l'étiquette rouge
 * de la bonne note naît de l'écrasement, fait un rebond court et pesant, puis
 * tient jusqu'à la note suivante. Mat et lourd : ni étincelle, ni halo.
 */

/** Anticipation (s) : le point se soulève en s'étirant. */
const RISE = 0.04
/** Chute (s) : accélérée, jusqu'au contact. */
const FALL = 0.032
/** Instant du contact (s) : ondes et enfoncement partent. */
const IMPACT = RISE + FALL
/** Écrasement du point (s), puis l'étiquette prend sa place sous la même forme. */
const SQUASH = 0.014
const LAND_AT = IMPACT + SQUASH
/** Atterrissage de l'étiquette (s) : détente, petit rebond, tassement, repos. */
const LAND = 0.22
/** Jalons de l'atterrissage (fraction de `LAND`) : sommet du rebond, second contact. */
const LAND_TIMES = [0, 0.3, 0.58, 1]
/** Onde de choc (s) et enfoncement du bois (s), à partir du contact. */
const RIPPLE_FOR = 0.3
const DENT_FOR = 0.36
/** Fondu de sortie (ms) : la note tient jusqu'à l'approche de la suivante, puis s'efface vite. */
const EXIT_FADE_MS = 180
/** Le point tombe dans un corps aplati de cette taille (× repère) au contact. */
const SQUASH_W = 1.45
const SQUASH_H = 0.5

/** Soulèvement ralenti en haut, chute accélérée, écrasement sec au contact. */
const DROP: Transition = {
  duration: LAND_AT,
  times: [0, RISE / LAND_AT, IMPACT / LAND_AT, 1],
  ease: [ease.outQuart, ease.inQuad, ease.outExpo],
}
/** Relais instantané : le point écrasé disparaît, l'étiquette apparaît sous la même forme. */
const HANDOFF: Transition = { delay: LAND_AT, duration: 0.001 }
/** Le point rougit pendant sa chute. */
const REDDEN: Transition = { delay: RISE, duration: FALL, ease: ease.inQuad }
/** Échelle de l'étiquette : détente explosive, retombée, tassement amorti. */
const LAND_SCALE: Transition = {
  delay: LAND_AT,
  duration: LAND,
  times: LAND_TIMES,
  ease: [ease.outExpo, ease.inQuad, ease.outQuart],
}
/** Hauteur de l'étiquette : rebond court, retombée accélérée. */
const LAND_HOP: Transition = {
  delay: LAND_AT,
  duration: LAND,
  times: LAND_TIMES,
  ease: [ease.outQuart, ease.inQuad, 'linear'],
}

/** Bas des éléments : ils s'écrasent sur leur base, pas autour de leur centre. */
const BASE_ORIGIN = '50% 100%'

interface Ring {
  /** Demi-axes de départ et d'arrivée (px). */
  from: [number, number]
  to: [number, number]
  stroke: [number, number]
  opacity: number
  delay: number
  duration: number
}

interface Thud {
  fontSize: number
  /** Hauteur du soulèvement (px). */
  lift: number
  /** Le point descend jusqu'à cette ligne de sol (px) : la base de l'étiquette. */
  ground: number
  /** Centre du point écrasé au contact (px sous le repère). */
  contact: number
  /** Échelle de l'étiquette au contact : celle du point écrasé. */
  fromX: number
  fromY: number
  /** Étirement (sommet du rebond) et tassement (second contact). */
  stretch: number
  squash: number
  /** Hauteur du rebond (px) et inclinaison à l'atterrissage (°). */
  hop: number
  tilt: number
  rings: Ring[]
  /** Demi-côté de la boîte SVG des ondes (px). */
  extent: number
  /** Étalement de l'enfoncement (× repère). */
  dent: [number, number]
}

function buildThud(seed: number, markerSize: number, label: string): Thud {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  const { halfW, halfH } = estimateLabelBox(fontSize, label)
  const ground = Math.max(0, halfH - markerSize / 2)
  const contact = halfH - (markerSize * SQUASH_H) / 2

  // Onde principale : part de sous le point, déborde de l'étiquette, écrasée au ras du bois.
  const flat = range(random, 0.48, 0.6)
  const reach = halfW + markerSize * range(random, 0.9, 1.4)
  const start = markerSize * 0.6
  const width = Math.max(1.5, markerSize * 0.16)
  const rings: Ring[] = [
    {
      from: [start, start * flat],
      to: [reach, reach * flat],
      stroke: [width * 1.6, width * 0.5],
      opacity: 0.9,
      delay: IMPACT,
      duration: RIPPLE_FOR,
    },
  ]
  // Une fois sur deux, une seconde onde plus courte et plus pâle suit la première.
  if (random() < 0.5) {
    const inner = reach * range(random, 0.62, 0.75)
    rings.push({
      from: [start, start * flat],
      to: [inner, inner * flat],
      stroke: [width, width * 0.4],
      opacity: 0.5,
      delay: IMPACT + range(random, 0.04, 0.065),
      duration: RIPPLE_FOR * 0.85,
    })
  }

  const side = random() < 0.5 ? -1 : 1
  return {
    fontSize,
    lift: Math.max(3, markerSize * range(random, 0.4, 0.6)),
    ground,
    contact,
    fromX: (markerSize * SQUASH_W) / (2 * halfW),
    fromY: (markerSize * SQUASH_H) / (2 * halfH),
    stretch: range(random, 0.05, 0.09),
    squash: range(random, 0.06, 0.1),
    hop: fontSize * range(random, 0.16, 0.26),
    tilt: side * range(random, 1.5, 3.5),
    rings,
    extent: reach + width * 2,
    dent: [range(random, 2, 2.5), range(random, 1.2, 1.5)],
  }
}

function DullThud({
  label,
  x,
  y,
  markerSize,
  seed,
  budgetMs,
  color,
  colorForeground,
  onComplete,
}: RevealEffectProps) {
  const thud = useMemo(() => buildThud(seed, markerSize, label), [seed, markerSize, label])
  const exit = revealExit(budgetMs, { fadeMs: EXIT_FADE_MS })
  useCompleteAfter(exit.lifetimeMs, onComplete)

  const { fontSize, lift, ground, fromX, fromY, stretch, squash, hop, tilt, extent } = thud
  const size = extent * 2
  // Ombre portée sombre et serrée : l'étiquette pèse sur le bois au lieu d'irradier.
  const pillStyle = {
    ...revealPillStyle(color, colorForeground, 0),
    boxShadow: '0 0.12em 0.3em color-mix(in oklch, var(--fretboard-shadow) 85%, transparent)',
    transformOrigin: BASE_ORIGIN,
  }
  // Rouge éteint : la couleur d'erreur assourdie par l'ombre du manche.
  const dullColor = `color-mix(in oklch, ${color} 62%, var(--fretboard-shadow))`

  return (
    <RevealRoot
      x={x}
      y={y}
      effect="dull-thud"
      // L'ensemble s'enfonce légèrement en s'effaçant.
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.94] }}
      transition={exit.transition}
    >
      {/* Ombre de contact : rétrécit quand le point se soulève, puis s'étale en enfoncement
          sous le point écrasé. Part de l'ombre portée du repère (décalée de 7 %). */}
      <motion.div
        data-slot="reveal-dent"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-fretboard-shadow')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ opacity: 0.8, scaleX: 1, scaleY: 1, y: markerSize * 0.07 }}
        animate={{
          y: [markerSize * 0.07, markerSize * 0.07, thud.contact, thud.contact],
          opacity: [0.8, 0.45, 0.9, 0],
          scaleX: [1, 0.7, 1.2, thud.dent[0]],
          scaleY: [1, 0.7, 0.8, thud.dent[1]],
        }}
        transition={{
          duration: IMPACT + DENT_FOR,
          times: [0, RISE / (IMPACT + DENT_FOR), IMPACT / (IMPACT + DENT_FOR), 1],
          ease: [ease.outQuart, ease.inQuad, ease.outQuart],
        }}
      />

      {/* Ondes : rouge éteint, au ras du bois, rapides ; épaisses au départ, puis effilées. */}
      <svg
        data-slot="reveal-ripples"
        className={cn(REVEAL_CENTERED, 'overflow-visible')}
        style={{ top: ground }}
        width={size}
        height={size}
        viewBox={`${-extent} ${-extent} ${size} ${size}`}
        fill="none"
      >
        {thud.rings.map((ring) => (
          // Masquée jusqu'au contact : pendant un délai, Motion applique déjà la valeur de départ.
          <motion.g
            key={ring.delay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: ring.delay, duration: 0.001 }}
          >
            <motion.ellipse
              data-slot="reveal-ripple"
              cx={0}
              cy={0}
              style={{ stroke: dullColor }}
              initial={{
                rx: ring.from[0],
                ry: ring.from[1],
                strokeWidth: ring.stroke[0],
                opacity: ring.opacity,
              }}
              animate={{ rx: ring.to[0], ry: ring.to[1], strokeWidth: ring.stroke[1], opacity: 0 }}
              transition={{ delay: ring.delay, duration: ring.duration, ease: ease.outExpo }}
            />
          </motion.g>
        ))}
      </svg>

      {/* Le point : se soulève en s'étirant, rougit en tombant, s'écrase au contact. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize, transformOrigin: BASE_ORIGIN }}
        initial={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
        animate={{
          y: [0, -lift, ground, ground],
          scaleX: [1, 0.86, 0.74, SQUASH_W],
          scaleY: [1, 1.14, 1.32, SQUASH_H],
          opacity: 0,
        }}
        transition={{ default: DROP, opacity: HANDOFF }}
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={REDDEN}
        />
      </motion.div>

      {/* L'étiquette naît du point écrasé, rebondit une fois, lourdement, et se pose. */}
      <div data-slot="reveal-label" className={cn(REVEAL_CENTERED, 'w-max')} style={{ fontSize }}>
        <motion.span
          data-slot="reveal-label-pill"
          className={REVEAL_PILL}
          style={pillStyle}
          initial={{ opacity: 0, scaleX: fromX, scaleY: fromY, y: 0, rotate: tilt }}
          animate={{
            opacity: 1,
            scaleX: [fromX, 1 - stretch * 0.6, 1 + squash * 0.6, 1],
            scaleY: [fromY, 1 + stretch, 1 - squash, 1],
            y: [0, -hop, 0, 0],
            rotate: [tilt, tilt * 0.4, -tilt * 0.15, 0],
          }}
          transition={{
            opacity: HANDOFF,
            y: LAND_HOP,
            default: LAND_SCALE,
          }}
        >
          {label}
        </motion.span>
      </div>
    </RevealRoot>
  )
}

export const dullThudEffect: RevealEffect = {
  id: 'dull-thud',
  name: 'Coup sourd',
  outcomes: ['wrong'],
  Component: DullThud,
}
