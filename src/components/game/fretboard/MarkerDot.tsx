import { motion, type Transition } from 'motion/react'

import { duration, ease, spring } from '@/theme/motion'

/** Apparition « note suivante ! » : pop très raide, posé en moins de 250 ms. */
const POP_IN: Transition = spring.pop
/** Disparition éclair : un effet de révélation prend le relais au même endroit. */
const EXIT: Transition = { duration: duration.instant, ease: ease.inQuad }
/** Respiration du halo : faible amplitude, en boucle. */
const PULSE: Transition = { duration: duration.pulse, ease: ease.inOut, repeat: Infinity }
/** Onde de choc à l'apparition. */
const SHOCKWAVE: Transition = { duration: duration.reveal, ease: ease.outExpo }
/** Étincelles de la triade : chacune part du point, s'éloigne et s'éteint, en boucle décalée. */
const SPARK_COUNT = 8
const SPARK_SECONDS = 1.5

const CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface MarkerDotProps {
  cx: number
  cy: number
  r: number
  /** Identifiant du dégradé de halo (défini une fois par le parent, couleur `--marker-halo`). */
  haloId: string
  /** Identifiant du dégradé de lueur de la triade (couleur `--triad-glow`). */
  triadGlowId?: string
  /**
   * `assist` : note du coup de pouce, cerclée d'un anneau ambré (`--assist`) ;
   * `triad` : note d'une triade, nimbée de vert acide et semée d'étincelles (`--triad`).
   */
  variant?: 'default' | 'assist' | 'triad'
  reduceMotion: boolean
}

/** Étincelles vert acide autour d'une note de triade. */
function TriadSparks({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return Array.from({ length: SPARK_COUNT }, (_, i) => {
    // Répartition régulière, légèrement désaxée pour ne pas paraître mécanique.
    const angle = (i / SPARK_COUNT) * Math.PI * 2 + (i % 2 === 0 ? 0.25 : -0.15)
    const travel = r * (1.5 + (i % 3) * 0.4)
    return (
      <motion.circle
        key={i}
        data-slot="fretboard-marker-spark"
        cx={cx + Math.cos(angle) * r * 1.1}
        cy={cy + Math.sin(angle) * r * 1.1}
        r={r * (i % 3 === 0 ? 0.22 : 0.14)}
        className="fill-triad"
        initial={{ opacity: 0, x: 0, y: 0 }}
        animate={{ opacity: [0, 1, 0], x: Math.cos(angle) * travel, y: Math.sin(angle) * travel }}
        transition={{
          duration: SPARK_SECONDS,
          ease: ease.outQuart,
          repeat: Infinity,
          delay: (i * SPARK_SECONDS) / SPARK_COUNT,
        }}
      />
    )
  })
}

/** Le point à deviner. À monter dans `AnimatePresence`, clé = identifiant de la note. */
export function MarkerDot({
  cx,
  cy,
  r,
  haloId,
  triadGlowId,
  variant = 'default',
  reduceMotion,
}: MarkerDotProps) {
  return (
    <motion.g
      data-slot="fretboard-marker"
      data-variant={variant}
      style={CENTERED}
      initial={reduceMotion ? { opacity: 0 } : { scale: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        transition: reduceMotion ? { duration: duration.fast } : POP_IN,
      }}
      exit={{ scale: 0.4, opacity: 0, transition: EXIT }}
    >
      {variant === 'triad' && triadGlowId && (
        <motion.circle
          data-slot="fretboard-marker-triad-glow"
          cx={cx}
          cy={cy}
          r={r * 3.2}
          fill={`url(#${triadGlowId})`}
          style={CENTERED}
          animate={reduceMotion ? undefined : { scale: [1, 1.15, 1], opacity: [0.75, 1, 0.75] }}
          transition={PULSE}
        />
      )}
      {variant === 'triad' && !reduceMotion && <TriadSparks cx={cx} cy={cy} r={r} />}
      <motion.circle
        data-slot="fretboard-marker-halo"
        cx={cx}
        cy={cy}
        r={r * 1.75}
        fill={`url(#${haloId})`}
        style={CENTERED}
        animate={reduceMotion ? undefined : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={PULSE}
      />
      {!reduceMotion && (
        <motion.circle
          data-slot="fretboard-marker-shockwave"
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="stroke-marker"
          strokeWidth={r * 0.22}
          style={CENTERED}
          initial={{ scale: 0.9, opacity: 0.9 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={SHOCKWAVE}
        />
      )}
      <circle
        data-slot="fretboard-marker-shadow"
        cx={cx}
        cy={cy + r * 0.14}
        r={r}
        className="fill-fretboard-shadow"
        fillOpacity={0.8}
      />
      {variant === 'assist' && (
        <circle
          data-slot="fretboard-marker-assist"
          cx={cx}
          cy={cy}
          r={r * 1.45}
          fill="none"
          className="stroke-assist"
          strokeWidth={r * 0.3}
        />
      )}
      <circle
        data-slot="fretboard-marker-dot"
        cx={cx}
        cy={cy}
        r={r}
        className="fill-marker stroke-marker-outline"
        strokeWidth={r * 0.08}
      />
    </motion.g>
  )
}
