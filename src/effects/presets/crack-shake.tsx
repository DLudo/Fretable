import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion, type Easing, type Transition } from 'motion/react'

import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'
import { range, seededRandom } from '../random'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Fêlure » (erreur) : le point vire au rouge, le manche se fend en éclairs
 * irréguliers autour de lui et l'étiquette de la bonne note fait « non » de la
 * tête (secousse horizontale amortie) avant de s'immobiliser. Sec et lisible,
 * jamais festif : ni dépassement, ni particules, ni halo de célébration.
 */

/** Durée de vie (ms). La note suivante n'apparaît que ~950 ms après une erreur. */
const LIFETIME_MS = 1120
/** Fin du maintien (s) : la bonne note reste lisible jusque-là, puis s'efface vite. */
const HOLD_UNTIL = 0.9
const FADE_FOR = 0.16
/** Le point rougit (s) avant de s'ouvrir en étiquette. */
const FLASH = 0.04
/** Ouverture du point en étiquette (s). */
const GROW = 0.11
/** Tracé des fêlures (s). */
const CRACK_AT = 0.02
const CRACK_DRAW = 0.12
/** Les fêlures s'estompent avant le maintien de l'étiquette (s). */
const CRACK_FADE_AT = 0.34
const CRACK_FADE_FOR = 0.3
/** Secousse horizontale amortie (s). */
const SHAKE_AT = 0.075
const SHAKE_FOR = 0.3

const EXIT_TOTAL = HOLD_UNTIL + FADE_FOR
const EXIT: Transition = {
  duration: EXIT_TOTAL,
  times: [0, HOLD_UNTIL / EXIT_TOTAL, 1],
  // Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la timeline.
  ease: ['linear', ease.outQuart],
}

/** Mouvement réduit : apparition, maintien, disparition. */
const REDUCED_EASE: Easing[] = [ease.outQuart, 'linear', ease.outQuart]
const REDUCED_TIMES = [0, 0.12 / EXIT_TOTAL, HOLD_UNTIL / EXIT_TOTAL, 1]

const CENTERED = 'absolute top-0 left-0 -translate-1/2'
const PILL =
  'block rounded-full px-[0.7em] py-[0.38em] leading-none font-semibold whitespace-nowrap'

interface Crack {
  points: string
  width: number
  delay: number
  duration: number
}

interface Fracture {
  fontSize: number
  /** Échelle de départ de l'étiquette : la taille du point. */
  fromX: number
  fromY: number
  cracks: Crack[]
  /** Demi-côté de la boîte SVG qui contient toutes les fêlures (px). */
  extent: number
  shake: { x: number[]; times: number[] }
}

const toPoints = (pts: [number, number][]) =>
  pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')

function buildFracture(seed: number, markerSize: number, label: string): Fracture {
  const random = seededRandom(seed)
  const fontSize = Math.min(22, Math.max(12, markerSize * 0.62))
  // Demi-axes estimés de l'étiquette (hauteur exacte : 1em + 2 × 0.38em).
  const halfW = (fontSize * (0.62 * [...label].length + 1.4)) / 2
  const halfH = (fontSize * 1.76) / 2

  // 4 à 7 fêlures, réparties irrégulièrement autour du point, de longueurs très variables.
  const count = 4 + Math.floor(random() * 4)
  const turn = random() * Math.PI * 2
  const start = markerSize * 0.3
  const main = Math.floor(random() * count)
  const cracks: Crack[] = []
  let extent = markerSize
  let branches = 0
  for (let i = 0; i < count; i++) {
    const theta = turn + ((i + range(random, -0.4, 0.4)) / count) * Math.PI * 2
    // Rayon polaire de l'ellipse inscrite dans l'étiquette : la fêlure dépasse toujours d'elle.
    const edge = (halfW * halfH) / Math.hypot(halfH * Math.cos(theta), halfW * Math.sin(theta))
    const reach =
      Math.max(edge, markerSize * 0.5) + markerSize * range(random, 0.45, 1.5) * (i === main ? 1.5 : 1)
    // Tracé en zigzag : cap qui dérive (marche aléatoire) + brisures alternées.
    const segments = 4 + Math.floor(random() * 3)
    const step = (reach - start) / segments
    let px = start * Math.cos(theta)
    let py = start * Math.sin(theta)
    const pts: [number, number][] = [[px, py]]
    let drift = 0
    let side = random() < 0.5 ? -1 : 1
    for (let s = 0; s < segments; s++) {
      drift = Math.max(-0.5, Math.min(0.5, drift + range(random, -0.35, 0.35)))
      const heading = theta + drift + side * range(random, 0.1, 0.55)
      if (random() < 0.75) side = -side
      const length = step * range(random, 0.6, 1.4)
      px += length * Math.cos(heading)
      py += length * Math.sin(heading)
      pts.push([px, py])
    }
    const delay = CRACK_AT + range(random, 0, 0.035)
    const width = range(random, 1.1, 1.5)
    // Effilement : un trait fin sur toute la longueur, doublé d'un trait épais sur la
    // première moitié, tracés en même temps (la partie épaisse reste ~55 % du tracé).
    cracks.push({ points: toPoints(pts), width, delay, duration: CRACK_DRAW })
    cracks.push({
      points: toPoints(pts.slice(0, Math.ceil(pts.length * 0.55))),
      width: width * range(random, 1.7, 2.1),
      delay,
      duration: CRACK_DRAW,
    })
    extent = Math.max(extent, Math.hypot(px, py))

    // Quelques ramifications fines, qui partent d'un sommet quand le tracé l'atteint.
    if (branches < 3 && random() < 0.4) {
      branches++
      const k = 2 + Math.floor(random() * (segments - 2))
      let [bx, by] = pts[k]
      const branch: [number, number][] = [[bx, by]]
      const bend = (random() < 0.5 ? -1 : 1) * range(random, 0.5, 0.9)
      for (let s = 0; s < 2; s++) {
        const heading = theta + bend * (s === 0 ? 1 : range(random, 0.2, 0.6))
        const length = step * range(random, 0.6, 1)
        bx += length * Math.cos(heading)
        by += length * Math.sin(heading)
        branch.push([bx, by])
      }
      cracks.push({
        points: toPoints(branch),
        width: width * 0.8,
        delay: delay + CRACK_DRAW * 0.3 * (k / segments),
        duration: CRACK_DRAW * 0.8,
      })
      extent = Math.max(extent, Math.hypot(bx, by))
    }
  }

  // Secousse amortie ±6 px → 0, sens de départ tiré au sort ; demi-période constante,
  // premier et dernier segments en quart de période (départ sec, arrêt net).
  const amplitude = range(random, 5.5, 6.5)
  const sign = random() < 0.5 ? -1 : 1
  const swings = 5 + Math.floor(random() * 2)
  const decay = range(random, 0.28, 0.38)
  const x = [0]
  for (let i = 0; i < swings; i++) {
    x.push(sign * (i % 2 === 0 ? 1 : -1) * amplitude * Math.exp(-i * decay))
  }
  x.push(0)
  const times = x.map((_, i) => (i === 0 ? 0 : i === x.length - 1 ? 1 : (i - 0.5) / swings))

  return {
    fontSize,
    fromX: (markerSize * 0.95) / (2 * halfW),
    fromY: (markerSize * 0.95) / (2 * halfH),
    cracks,
    extent: extent + 4,
    shake: { x, times },
  }
}

/** Appelle `onComplete` une seule fois après `ms`, robuste au double montage de StrictMode. */
function useCompleteAfter(ms: number, onComplete: () => void) {
  const callback = useRef(onComplete)
  const done = useRef(false)
  useEffect(() => {
    callback.current = onComplete
  })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (done.current) return
      done.current = true
      callback.current()
    }, ms)
    return () => window.clearTimeout(timer)
  }, [ms])
}

// oxlint-disable-next-line react/only-export-components -- exporté via son descripteur d'effet
function CrackShake({
  label,
  x,
  y,
  markerSize,
  seed,
  color,
  colorForeground,
  onComplete,
}: RevealEffectProps) {
  const reduceMotion = useReducedMotion()
  useCompleteAfter(LIFETIME_MS, onComplete)
  const fracture = useMemo(
    () => buildFracture(seed, markerSize, label),
    [seed, markerSize, label],
  )
  const { fontSize, cracks, extent } = fracture
  // Ombre serrée : détache l'étiquette du manche sans halo de célébration.
  const pillStyle = {
    background: color,
    color: colorForeground,
    boxShadow: `0 0 10px color-mix(in oklch, ${color} 35%, transparent)`,
  }

  if (reduceMotion) {
    return (
      <motion.div
        data-slot="reveal-effect"
        data-effect="crack-shake"
        className="pointer-events-none absolute size-0 overflow-visible"
        style={{ left: x, top: y }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 1] }}
        transition={{ duration: EXIT_TOTAL, times: REDUCED_TIMES, ease: REDUCED_EASE }}
      >
        <div data-slot="reveal-label" className={cn(CENTERED, 'w-max')} style={{ fontSize }}>
          <span data-slot="reveal-label-pill" className={PILL} style={pillStyle}>
            {label}
          </span>
        </div>
      </motion.div>
    )
  }

  const size = extent * 2

  return (
    <motion.div
      data-slot="reveal-effect"
      data-effect="crack-shake"
      className="pointer-events-none absolute size-0 overflow-visible"
      style={{ left: x, top: y }}
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.94] }}
      transition={EXIT}
    >
      {/* Fêlures : nées sous le point, tracées vers l'extérieur, puis estompées. */}
      <motion.svg
        data-slot="reveal-cracks"
        className={cn(CENTERED, 'overflow-visible')}
        width={size}
        height={size}
        viewBox={`${-extent} ${-extent} ${size} ${size}`}
        fill="none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: CRACK_FADE_AT, duration: CRACK_FADE_FOR, ease: ease.outQuart }}
      >
        {cracks.map((crack) => (
          <motion.polyline
            key={crack.points}
            data-slot="reveal-crack"
            points={crack.points}
            strokeWidth={crack.width}
            strokeLinecap="butt"
            strokeLinejoin="miter"
            style={{ stroke: color }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: crack.delay, duration: crack.duration, ease: ease.outExpo }}
          />
        ))}
      </motion.svg>

      {/* Le point d'origine, au-dessus des fêlures naissantes, effacé par le flash rouge. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: FLASH * 0.5, duration: FLASH, ease: 'linear' }}
      />

      {/* Le point vire au rouge, se crispe, puis s'ouvre en étiquette qui secoue la tête. */}
      <motion.div
        data-slot="reveal-shake"
        className="absolute top-0 left-0 size-0"
        initial={{ x: 0 }}
        animate={{ x: fracture.shake.x }}
        transition={{
          delay: SHAKE_AT,
          duration: SHAKE_FOR,
          times: fracture.shake.times,
          ease: fracture.shake.times.slice(1).map((): Easing => 'easeInOut'),
        }}
      >
        <div data-slot="reveal-label" className={cn(CENTERED, 'w-max')} style={{ fontSize }}>
          <motion.span
            data-slot="reveal-label-pill"
            className={PILL}
            style={pillStyle}
            initial={{ opacity: 0, scaleX: fracture.fromX, scaleY: fracture.fromY }}
            animate={{
              opacity: 1,
              scaleX: [fracture.fromX, fracture.fromX * 0.82, 1],
              scaleY: [fracture.fromY, fracture.fromY * 0.82, 1],
            }}
            transition={{
              opacity: { duration: FLASH * 0.6, ease: 'linear' },
              default: {
                duration: FLASH + GROW,
                times: [0, FLASH / (FLASH + GROW), 1],
                ease: [ease.outQuart, ease.outExpo],
              },
            }}
          >
            <motion.span
              className="block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: FLASH + 0.02, duration: 0.05, ease: 'linear' }}
            >
              {label}
            </motion.span>
          </motion.span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export const crackShakeEffect: RevealEffect = {
  id: 'crack-shake',
  name: 'Fêlure',
  outcomes: ['wrong'],
  Component: CrackShake,
}
