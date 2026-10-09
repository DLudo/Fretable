import { useMemo } from 'react'
import { motion, type Easing } from 'motion/react'

import { NOTES } from '@/game/music/notes'
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
/** Flash blanc du verrouillage (s). */
const LOCK_FLASH = 0.205
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

  // Boîte estimée de l'étiquette : la plus longue case fixe la largeur de la fenêtre,
  // la hauteur d'une case est celle de l'étiquette.
  const longest = strip.reduce((a, b) => ([...b].length > [...a].length ? b : a))
  const { halfW, halfH } = estimateLabelBox(fontSize, longest)
  const width = 2 * halfW
  const item = 2 * halfH

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

function SlotRoll({
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
  const reel = useMemo(
    () => buildReel(seed, intensity, markerSize, label),
    [seed, intensity, markerSize, label],
  )
  const { fontSize, item, stop, ring } = reel
  const comboScale = comboScaleFor(streak)
  // Ouverture, attente du verrouillage, coup de tampon, retour au repos.
  const body = ROLL + PUNCH
  const bodyTimes = [0, OPEN / body, ROLL / body, (ROLL + 0.05) / body, 1]
  const bodyEase: Easing[] = [ease.outExpo, 'linear', ease.outQuart, ease.outBack]

  return (
    <RevealRoot
      x={x}
      y={y}
      effect="slot-roll"
      animate={{ opacity: [1, 1, 0], scale: [1, 1, 0.96] }}
      transition={exit.transition}
    >
      {/* Éclair blanc derrière l'étiquette au verrouillage. */}
      <motion.div
        data-slot="reveal-flash"
        className={cn(REVEAL_CENTERED, 'rounded-full')}
        style={{
          width: markerSize * 3,
          height: markerSize * 3,
          background: `radial-gradient(closest-side, ${highlight}, transparent)`,
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
            style={{ ...SVG_CENTERED, stroke: highlight }}
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
          className={cn(REVEAL_CENTERED, 'block rounded-[1px]')}
          style={{ width: c.width, height: c.height, background: c.white ? highlight : color }}
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
          // Forme et typographie de l'étiquette ; hauteur fixée à une case du rouleau.
          className={cn(REVEAL_PILL, 'relative overflow-hidden py-0')}
          style={{ ...revealPillStyle(color, colorForeground, reel.glow), height: item }}
          initial={{ scaleX: reel.fromX, scaleY: reel.fromY, rotate: 0 }}
          animate={{
            scaleX: [reel.fromX, 1, 1, reel.punch, 1],
            scaleY: [reel.fromY, 1, 1, reel.punch, 1],
            rotate: [0, 0, 0, reel.tilt, 0],
          }}
          transition={{ duration: body, times: bodyTimes, ease: bodyEase }}
        >
          {/* Sous le texte : le point qui s'ouvre (couleur du repère)… */}
          <motion.span
            data-slot="reveal-open-fill"
            className="absolute inset-0 bg-marker"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: OPEN, ease: ease.outQuart }}
          />
          {/* …puis le flash blanc du verrouillage. */}
          <motion.span
            data-slot="reveal-lock-flash"
            className="absolute inset-0"
            style={{ background: highlight }}
            initial={{ opacity: 0 }}
            // Premier keyframe à 0 : WAAPI l'affiche pendant le délai.
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{
              delay: ROLL - 0.005,
              duration: LOCK_FLASH,
              times: [0, 0.005 / LOCK_FLASH, 1],
              ease: ['linear', ease.outQuart],
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

        <RevealCombo
          streak={streak}
          color={color}
          colorForeground={colorForeground}
          className="-translate-x-[45%] -translate-y-[60%]"
          // Tombe d'en haut comme un symbole de rouleau, puis rebondit.
          initial={{ y: -item * 0.8, scale: 0.4, rotate: 0, opacity: 0 }}
          animate={{ y: 0, scale: comboScale, rotate: reel.comboTilt, opacity: 1 }}
          transition={{
            delay: ROLL + 0.03,
            duration: 0.24,
            ease: ease.outBack,
            opacity: { delay: ROLL + 0.03, duration: 0.05, ease: 'linear' },
          }}
        />
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
    </RevealRoot>
  )
}

export const slotRollEffect: RevealEffect = {
  id: 'slot-roll',
  name: 'Machine à sous',
  outcomes: ['correct'],
  Component: SlotRoll,
}
