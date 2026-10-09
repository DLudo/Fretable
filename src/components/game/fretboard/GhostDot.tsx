import { motion, type Transition } from 'motion/react'

import { duration, ease } from '@/theme/motion'

const ENTER: Transition = { duration: duration.base, ease: ease.outQuart }
const EXIT: Transition = { duration: duration.fast, ease: ease.inQuad }
const CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface GhostDotProps {
  cx: number
  cy: number
  r: number
  /** Dégradé de lueur de la triade : un léger nimbe signale qu'elle en fait partie. */
  triadGlowId?: string
  /** Délai d'apparition (s), pour égrener les notes du grave à l'aigu. */
  delay?: number
  reduceMotion: boolean
}

/**
 * Note à venir, en filigrane : un point gris, un peu plus petit que la note à
 * deviner. À monter dans `AnimatePresence`, clé = position.
 */
export function GhostDot({ cx, cy, r, triadGlowId, delay = 0, reduceMotion }: GhostDotProps) {
  return (
    <motion.g
      data-slot="fretboard-ghost"
      style={CENTERED}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, transition: { ...ENTER, delay } }}
      exit={{ opacity: 0, scale: 0.7, transition: EXIT }}
    >
      {triadGlowId && (
        <circle cx={cx} cy={cy} r={r * 1.9} fill={`url(#${triadGlowId})`} opacity={0.35} />
      )}
      <circle
        data-slot="fretboard-ghost-dot"
        cx={cx}
        cy={cy}
        r={r * 0.82}
        className="fill-marker-ghost stroke-marker-ghost"
        strokeWidth={r * 0.12}
      />
    </motion.g>
  )
}
