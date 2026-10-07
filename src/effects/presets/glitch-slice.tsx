import { useMemo } from 'react'
import { motion, type Easing, type Transition } from 'motion/react'

import { range, seededRandom } from '@/lib/random'
import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'
import {
  REVEAL_CENTERED,
  REVEAL_PILL,
  RevealRoot,
  labelFontSize,
  revealExit,
  revealPillStyle,
  useCompleteAfter,
} from '../kit'
import type { RevealEffect, RevealEffectProps } from '../types'

/**
 * « Glitch » (erreur) : le point s'écrase en trait comme un écran cathodique,
 * puis l'étiquette rouge de la bonne note s'allume en signal parasité : copies
 * fantômes décalées (séparation des couleurs), bandes horizontales qui
 * sautent de côté, lignes de bruit. Le signal se stabilise, une réplique
 * parasite parfois l'étiquette, puis l'écran « s'éteint ». Sec, jamais festif.
 */

/** Le point s'écrase en trait, puis disparaît (s). */
const SQUASH_AT = 0.022
const LABEL_AT = 0.042
/** Allumage de l'étiquette : trait → étirement → repos (s). */
const SNAP_FOR = 0.075
/** Parasitage principal (s). */
const GLITCH_AT = LABEL_AT + SNAP_FOR / 2
const GLITCH_FOR = 0.25
/**
 * Extinction cathodique (ms) : la bonne note reste lisible jusqu'à l'approche de
 * la note suivante (`budgetMs`), puis l'écran s'éteint d'un coup.
 */
const OFF_MS = 120
/** Ombre serrée de l'étiquette (px, % de couleur) : la détache du manche sans halo de célébration. */
const SHADOW_PX = 10
const SHADOW_MIX = 35

/** Courbe « en créneau » : la valeur tient jusqu'au keyframe suivant, puis saute (signal numérique). */
const hold = (t: number) => (t < 1 ? 0 : 1)
/**
 * Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la
 * timeline quand Motion délègue l'opacité à WAAPI.
 */
const holdEach = (keyframes: number): Easing[] => Array.from({ length: keyframes - 1 }, () => hold)

const COPY = cn(REVEAL_PILL, 'absolute inset-0')

interface Slice {
  clipPath: string
  x: number[]
}

interface Ghost {
  x: number[]
  y: number[]
  opacity: number[]
}

interface NoiseBar {
  /** Position et largeur en % de l'étiquette. */
  top: number
  left: number
  width: number
  x: number[]
  opacity: number[]
  hot: boolean
}

interface Glitch {
  fontSize: number
  /** Horodatage partagé (0 → 1) de tous les sauts, à partir de `GLITCH_AT`. */
  times: number[]
  duration: number
  slices: Slice[]
  ghosts: [Ghost, Ghost]
  bars: NoiseBar[]
  /** Opacité de l'étiquette « propre » (ombre comprise) sous les bandes. */
  settled: number[]
}

function buildGlitch(seed: number, markerSize: number): Glitch {
  const random = seededRandom(seed)
  const fontSize = labelFontSize(markerSize)
  const sign = () => (random() < 0.5 ? -1 : 1)

  // Sauts du parasitage principal : 6 à 8 « images » de durées inégales.
  const steps = 6 + Math.floor(random() * 3)
  const weights = Array.from({ length: steps }, () => range(random, 0.6, 1.4))
  const total = weights.reduce((a, b) => a + b, 0)
  const at: number[] = [0]
  weights.forEach((w) => at.push(at[at.length - 1] + (w / total) * GLITCH_FOR))
  // Index du keyframe « stable » (fin du parasitage).
  const stable = steps
  // Réplique (7 fois sur 10) : bref sursaut d'une bande et des fantômes pendant le maintien.
  const aftershock = random() < 0.7
  let end = at[stable] + 0.05
  if (aftershock) {
    const shock = range(random, 0.48, 0.62) - GLITCH_AT
    at.push(shock, shock + range(random, 0.03, 0.045), shock + range(random, 0.07, 0.085))
    end = at[at.length - 1]
  }
  at.push(end)
  const times = at.map((t) => t / end)
  const frames = at.length
  const isGlitch = (j: number) => j < stable
  const shockIndex = (j: number) => (aftershock && j > stable && j < frames - 2 ? j - stable : 0)

  // 3 ou 4 bandes ; toutes sautent sauf une (2 à 3 bandes parasitées).
  const bandCount = 3 + Math.floor(random() * 2)
  const cuts = [0]
  for (let k = 1; k < bandCount; k++) cuts.push((k / bandCount) * 100 + range(random, -8, 8))
  cuts.push(100)
  const still = Math.floor(random() * bandCount)
  const shaken = (still + 1 + Math.floor(random() * (bandCount - 1))) % bandCount
  const amplitude = markerSize * range(random, 0.32, 0.5)
  const slices = Array.from({ length: bandCount }, (_, k): Slice => {
    // Léger recouvrement (0,6 px) entre bandes voisines : aucune couture une fois alignées.
    const top = k === 0 ? '0' : `calc(${cuts[k].toFixed(2)}% - 0.6px)`
    const bottom = k === bandCount - 1 ? '0' : `calc(${(100 - cuts[k + 1]).toFixed(2)}% - 0.6px)`
    const x = Array.from({ length: frames }, (_, j) => {
      if (isGlitch(j)) {
        if (k === still) return 0
        // Gros sauts d'abord, puis le signal se recale vite : l'étiquette est lisible dès ~120 ms.
        const decay = Math.exp(-j * 0.6)
        if (j > 0 && random() < 0.25) return 0
        return sign() * amplitude * decay * range(random, j === 0 ? 0.65 : 0.3, 1)
      }
      const s = shockIndex(j)
      if (k !== shaken || s === 0) return 0
      return s === 1 ? sign() * amplitude * range(random, 0.5, 0.8) : sign() * amplitude * 0.3
    })
    return { clipPath: `inset(${top} 0 ${bottom} 0)`, x }
  })

  // Deux fantômes décalés de ±3 px en sens opposés, qui frémissent puis se recalent.
  const ghost = (side: number): Ghost => {
    const baseX = side * range(random, 2.6, 3.4)
    const baseY = range(random, -1.2, 1.2)
    return {
      x: Array.from({ length: frames }, (_, j) =>
        isGlitch(j) || shockIndex(j) === 1 ? baseX + range(random, -1.6, 1.6) : 0,
      ),
      y: Array.from({ length: frames }, (_, j) =>
        isGlitch(j) || shockIndex(j) === 1 ? baseY + range(random, -0.8, 0.8) : 0,
      ),
      opacity: Array.from({ length: frames }, (_, j) =>
        isGlitch(j) ? (random() < 0.2 ? 0.45 : 1) : shockIndex(j) === 1 ? 0.8 : 0,
      ),
    }
  }
  const first = sign()

  // 2 ou 3 lignes de bruit qui clignotent pendant le parasitage.
  const barCount = 2 + Math.floor(random() * 2)
  const bars = Array.from({ length: barCount }, (): NoiseBar => ({
    // Au-dessus ou au-dessous de l'étiquette, jamais en travers du texte.
    top: random() < 0.5 ? range(random, -45, -14) : range(random, 114, 145),
    left: range(random, -35, 35),
    width: range(random, 45, 110),
    x: Array.from({ length: frames }, () => markerSize * range(random, -0.5, 0.5)),
    opacity: Array.from({ length: frames }, (_, j) =>
      isGlitch(j) && random() < 0.45 ? range(random, 0.5, 0.9) : 0,
    ),
    hot: random() < 0.5,
  }))

  return {
    fontSize,
    times,
    duration: end,
    slices,
    ghosts: [ghost(first), ghost(-first)],
    bars,
    settled: Array.from({ length: frames }, (_, j) => (isGlitch(j) ? 0 : 1)),
  }
}

function GlitchSlice({
  label,
  x,
  y,
  markerSize,
  seed,
  budgetMs,
  color,
  colorForeground,
  highlight,
  onComplete,
}: RevealEffectProps) {
  const exit = useMemo(() => revealExit(budgetMs, { fadeMs: OFF_MS }), [budgetMs])
  useCompleteAfter(exit.lifetimeMs, onComplete)
  const glitch = useMemo(() => buildGlitch(seed, markerSize), [seed, markerSize])
  const { fontSize } = glitch
  // Copies parasitées sans ombre ; l'étiquette stabilisée garde une ombre serrée.
  const pillStyle = revealPillStyle(color, colorForeground, 0)
  const settledStyle = revealPillStyle(color, colorForeground, SHADOW_PX, SHADOW_MIX)

  /**
   * Tous les sauts partagent la même horloge, en créneaux. Le premier tient pendant
   * l'allumage : la première image pleine taille est déjà parasitée.
   */
  const jumps: Transition = {
    delay: GLITCH_AT,
    duration: glitch.duration,
    times: glitch.times,
    ease: holdEach(glitch.times.length),
  }
  /** Extinction : l'image s'écrase en trait (ease-out) pendant que l'opacité tombe (ease-in). */
  const off: Transition = {
    ...exit.transition,
    ease: ['linear', ease.outExpo],
    opacity: { ...exit.transition, ease: ['linear', ease.inQuad] },
  }
  const ghostBackgrounds = [
    `color-mix(in oklch, ${color} 55%, transparent)`,
    `color-mix(in oklch, ${highlight} 40%, transparent)`,
  ]

  return (
    <RevealRoot
      x={x}
      y={y}
      effect="glitch-slice"
      // Extinction cathodique : l'image s'écrase en trait puis disparaît.
      animate={{ opacity: [1, 1, 0], scaleY: [1, 1, 0.08], scaleX: [1, 1, 1.2] }}
      transition={off}
    >
      {/* Le point d'origine s'écrase en trait horizontal, puis s'éteint. */}
      <motion.div
        data-slot="reveal-origin"
        className={cn(REVEAL_CENTERED, 'rounded-full bg-marker')}
        style={{ width: markerSize, height: markerSize }}
        initial={{ scaleX: 1, scaleY: 1, opacity: 1 }}
        animate={{ scaleX: [1, 2.2, 2.2], scaleY: [1, 0.16, 0.16], opacity: [1, 1, 0] }}
        transition={{ duration: LABEL_AT, times: [0, SQUASH_AT / LABEL_AT, 1], ease: holdEach(3) }}
      />

      {/* L'étiquette s'allume : trait → étirement → repos, en sauts secs. */}
      <motion.div
        data-slot="reveal-label"
        className={cn(REVEAL_CENTERED, 'w-max')}
        style={{ fontSize }}
        initial={{ opacity: 0, scaleX: 1.3, scaleY: 0.12 }}
        animate={{ opacity: 1, scaleX: [1.3, 0.94, 1.03, 1], scaleY: [0.12, 1.18, 0.97, 1] }}
        transition={{
          opacity: { delay: LABEL_AT, duration: 0.001 },
          default: { delay: LABEL_AT, duration: SNAP_FOR, ease: holdEach(4) },
        }}
      >
        {glitch.ghosts.map((ghost, i) => (
          <motion.span
            key={i}
            data-slot="reveal-glitch-ghost"
            aria-hidden
            className={COPY}
            style={{ background: ghostBackgrounds[i], color: 'transparent' }}
            initial={{ x: ghost.x[0], y: ghost.y[0], opacity: ghost.opacity[0] }}
            animate={{ x: ghost.x, y: ghost.y, opacity: ghost.opacity }}
            transition={jumps}
          >
            {label}
          </motion.span>
        ))}

        {/* Étiquette stabilisée : donne sa taille au groupe, n'apparaît (avec son ombre)
            qu'une fois le signal recalé. */}
        <motion.span
          data-slot="reveal-label-pill"
          className={cn(REVEAL_PILL, 'relative')}
          style={settledStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: glitch.settled }}
          transition={jumps}
        >
          {label}
        </motion.span>

        {glitch.slices.map((slice) => (
          <motion.span
            key={slice.clipPath}
            data-slot="reveal-glitch-slice"
            aria-hidden
            className={COPY}
            style={{ ...pillStyle, clipPath: slice.clipPath }}
            initial={{ x: slice.x[0] }}
            animate={{ x: slice.x }}
            transition={jumps}
          >
            {label}
          </motion.span>
        ))}

        {glitch.bars.map((bar) => (
          <motion.span
            key={`${bar.top}:${bar.left}`}
            data-slot="reveal-glitch-noise"
            className="absolute h-[0.12em] min-h-0.5"
            style={{
              top: `${bar.top}%`,
              left: `${bar.left}%`,
              width: `${bar.width}%`,
              background: bar.hot ? highlight : color,
            }}
            initial={{ x: bar.x[0], opacity: 0 }}
            animate={{ x: bar.x, opacity: bar.opacity }}
            transition={jumps}
          />
        ))}
      </motion.div>
    </RevealRoot>
  )
}

export const glitchSliceEffect: RevealEffect = {
  id: 'glitch-slice',
  name: 'Glitch',
  outcomes: ['wrong'],
  Component: GlitchSlice,
}
