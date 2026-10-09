import { motion, type Transition } from 'motion/react'

import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

const ENTER: Transition = { duration: duration.base, ease: ease.outQuart }
const EXIT: Transition = { duration: duration.fast, ease: ease.inQuad }
const CENTERED = { transformBox: 'fill-box', transformOrigin: 'center' } as const

/**
 * Aspect d'une note en filigrane :
 * - `plain` : à venir, simple cercle gris évidé ;
 * - `triad` : à venir, et partie de la triade (cercle évidé, léger nimbe vert acide) ;
 * - `hit` / `miss` : déjà jouée, petit point plein, juste (vert acide) ou manquée (rouge).
 *
 * Les notes à venir restent évidées et fines : pleines et grises, elles se
 * confondraient avec les repères des cases.
 */
export type GhostTone = 'plain' | 'triad' | 'hit' | 'miss'

const DOT_CLASS: Record<GhostTone, string> = {
  plain: 'fill-none stroke-marker-ghost',
  triad: 'fill-none stroke-marker-ghost',
  hit: 'fill-triad stroke-triad opacity-60',
  miss: 'fill-feedback-error stroke-feedback-error opacity-50',
}

/** Rayon et trait, en part du rayon de la note à deviner. */
const SHAPE: Record<GhostTone, { r: number; stroke: number }> = {
  plain: { r: 0.5, stroke: 0.1 },
  triad: { r: 0.5, stroke: 0.1 },
  hit: { r: 0.42, stroke: 0.1 },
  miss: { r: 0.42, stroke: 0.1 },
}

interface GhostDotProps {
  cx: number
  cy: number
  r: number
  tone?: GhostTone
  /** Dégradé de lueur de la triade (nimbe des notes `triad`). */
  triadGlowId?: string
  /** Délai d'apparition (s), pour égrener les notes du grave à l'aigu. */
  delay?: number
  reduceMotion: boolean
}

/**
 * Note en filigrane, bien plus petite et plus discrète que la note à deviner. À monter dans
 * `AnimatePresence`, clé = position : changer de ton ne la fait pas réapparaître.
 */
export function GhostDot({
  cx,
  cy,
  r,
  tone = 'plain',
  triadGlowId,
  delay = 0,
  reduceMotion,
}: GhostDotProps) {
  return (
    <motion.g
      data-slot="fretboard-ghost"
      data-tone={tone}
      style={CENTERED}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, transition: { ...ENTER, delay } }}
      exit={{ opacity: 0, scale: 0.7, transition: EXIT }}
    >
      {tone === 'triad' && triadGlowId && (
        <circle cx={cx} cy={cy} r={r * 1.4} fill={`url(#${triadGlowId})`} opacity={0.3} />
      )}
      <circle
        data-slot="fretboard-ghost-dot"
        cx={cx}
        cy={cy}
        r={r * SHAPE[tone].r}
        className={cn('transition-[fill,stroke,opacity] duration-300', DOT_CLASS[tone])}
        strokeWidth={r * SHAPE[tone].stroke}
      />
    </motion.g>
  )
}
