import { motion, type Transition } from 'motion/react'

import { duration, ease } from '@/theme/motion'

/**
 * Apparition « note suivante ! » : ressort très raide avec ~15 % de dépassement,
 * pic vers 100 ms, posé en moins de 250 ms.
 */
const POP_IN: Transition = { type: 'spring', stiffness: 800, damping: 22, mass: 0.6 }
/** Disparition éclair : un effet de révélation prend le relais au même endroit. */
const EXIT: Transition = { duration: duration.instant, ease: ease.inQuad }
/** Respiration du halo : faible amplitude, en boucle. */
const PULSE: Transition = { duration: 1.6, ease: 'easeInOut', repeat: Infinity }

const CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface MarkerDotProps {
  cx: number
  cy: number
  r: number
  /** Identifiant du dégradé de halo (défini une fois par le parent). */
  haloId: string
  reduceMotion: boolean
}

/** Le point à deviner. À monter dans `AnimatePresence`, clé = identifiant de la note. */
export function MarkerDot({ cx, cy, r, haloId, reduceMotion }: MarkerDotProps) {
  return (
    <motion.g
      data-slot="fretboard-marker"
      style={CENTERED}
      initial={reduceMotion ? { opacity: 0 } : { scale: 0 }}
      animate={{ scale: 1, opacity: 1, transition: reduceMotion ? { duration: duration.fast } : POP_IN }}
      exit={{ scale: 0.4, opacity: 0, transition: EXIT }}
    >
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
          transition={{ duration: duration.reveal, ease: ease.outExpo }}
        />
      )}
      <circle cx={cx} cy={cy + r * 0.14} r={r} className="fill-fretboard-edge" fillOpacity={0.8} />
      <circle
        data-slot="fretboard-marker-dot"
        cx={cx}
        cy={cy}
        r={r}
        className="fill-marker stroke-fretboard-edge"
        strokeWidth={r * 0.08}
      />
    </motion.g>
  )
}
