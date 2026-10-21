import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { formatScore } from '@/components/game/hud'
import { labelFontSize } from '@/effects/kit'
import type { GuessResult } from '@/game/engine/types'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { ease } from '@/theme/motion'
import { scorePopMotion, scorePopTone, type ScorePopMotion, type ScorePopTone } from './score-pop'

export interface ScorePopLayerProps {
  /** Dernière tentative : chaque bonne réponse fait jaillir ses points ; `null` (nouvelle partie) efface tout. */
  result: GuessResult | null
  layout: NeckLayout
  projection: BoardProjection
  /**
   * Multiplicateur d'affichage (lampes en surchauffe), comme le score du HUD :
   * au-delà de 1, chaque nombre s'entoure d'un halo orangé.
   */
  boost?: number
  /** Teinte d'une réponse (par défaut `scorePopTone`) : le boss y ajoute ses notes bonus. */
  toneOf?: (result: GuessResult) => ScorePopTone
}

interface Pop {
  id: number
  /** Ancre : juste au-dessus de l'étiquette de la note révélée (px, calque du manche). */
  x: number
  y: number
  value: number
  tone: ScorePopTone
  /** Lampes en surchauffe : halo orangé. */
  heated: boolean
  motion: ScorePopMotion
}

/** Couleur du chiffre par teinte ; le critique est un dégradé d'or en fusion. */
const TONE_STYLE: Record<ScorePopTone, CSSProperties> = {
  crit: {
    backgroundImage:
      'linear-gradient(180deg, var(--coin-shine) 10%, var(--coin) 48%, var(--combo-fire) 92%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
  },
  fire: { color: 'var(--combo-fire)' },
  combo: { color: 'color-mix(in oklab, var(--combo) 78%, white)' },
  triad: { color: 'var(--triad)' },
  scale: { color: 'var(--triad)' },
  assist: { color: 'var(--assist)' },
  normal: { color: 'var(--foreground)' },
}

/** Contour sombre, lisible sur le bois comme sur les cordes ; halo de braise pour le critique. */
const OUTLINE =
  'drop-shadow(0 2px 0 rgb(0 0 0 / 0.85)) drop-shadow(0 0 1px rgb(0 0 0)) drop-shadow(0 0 1px rgb(0 0 0))'
const CRIT_FILTER = `${OUTLINE} drop-shadow(0 0 12px var(--combo-fire-glow))`
/** Lampes en surchauffe : halo orangé autour de chaque nombre, plus ardent au critique. */
const HEAT_FILTER = `${OUTLINE} drop-shadow(0 0 4px var(--combo-fire)) drop-shadow(0 0 12px var(--combo-fire-glow))`
const HEATED_CRIT_FILTER = `${OUTLINE} drop-shadow(0 0 6px var(--combo-fire)) drop-shadow(0 0 22px var(--combo-fire-glow))`

function popFilter(crit: boolean, heated: boolean): string {
  if (heated) return crit ? HEATED_CRIT_FILTER : HEAT_FILTER
  return crit ? CRIT_FILTER : OUTLINE
}

/**
 * Place (px) entre le haut du calque et celui de la scène (le `main` de l'écran,
 * sous le bandeau) : les nombres n'en sortent pas. Suivie au redimensionnement.
 */
function useHeadroom() {
  const ref = useRef<HTMLDivElement>(null)
  const [headroom, setHeadroom] = useState(Infinity)
  useLayoutEffect(() => {
    const layer = ref.current
    const stage = layer?.closest('main')
    if (!layer || !stage) return
    const measure = () =>
      setHeadroom(layer.getBoundingClientRect().top - stage.getBoundingClientRect().top)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(layer)
    return () => observer.disconnect()
  }, [])
  return [ref, headroom] as const
}

/**
 * Nombres flottants, à la manière des dégâts infligés à un monstre dans un
 * MMORPG : chaque bonne réponse fait jaillir ses points au-dessus de la note,
 * qui montent en s'écartant puis s'effacent. Un coup critique (0,5 s ou moins)
 * s'abat plus gros, doré, incliné, coiffé de « Critique ». Purement décoratif :
 * le score se lit dans le HUD.
 */
export function ScorePopLayer({
  result,
  layout,
  projection,
  boost = 1,
  toneOf = scorePopTone,
}: ScorePopLayerProps): ReactNode {
  const reducedMotion = useReducedMotion() ?? false
  const [pops, setPops] = useState<Pop[]>([])
  const [layerRef, headroom] = useHeadroom()
  // Une réponse ne jaillit qu'une fois : celle déjà là au montage reste muette.
  const [seenId, setSeenId] = useState(() => result?.id ?? null)

  const resultId = result?.id ?? null
  if (resultId !== seenId) {
    setSeenId(resultId)
    if (result === null) {
      // Nouvelle partie : les nombres de la précédente ne doivent pas déborder dessus.
      setPops([])
    } else if (result.correct && result.points > 0) {
      const { stringIndex, fret } = result.challenge
      const dot = projection.toPx(layout.position(stringIndex, fret))
      const markerSize = layout.markerRadius * 2 * projection.pxPerMm
      const tone = toneOf(result)
      // Au ras du haut de l'étiquette (`REVEAL_PILL` : 1,76 em de haut, centrée sur le repère).
      const y = dot.y - labelFontSize(markerSize) * 0.88 - 2
      const pop: Pop = {
        id: result.id,
        x: dot.x,
        y,
        value: result.points * boost,
        tone,
        heated: boost > 1,
        motion: scorePopMotion(result.id, markerSize, tone, headroom + y),
      }
      setPops((list) => [...list, pop])
    }
  }

  const remove = useCallback((id: number) => {
    setPops((list) => list.filter((pop) => pop.id !== id))
  }, [])

  return (
    <div
      ref={layerRef}
      data-slot="score-pops"
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      {pops.map((pop) => (
        <ScorePop key={pop.id} pop={pop} reducedMotion={reducedMotion} onDone={remove} />
      ))}
    </div>
  )
}

function ScorePop({
  pop,
  reducedMotion,
  onDone,
}: {
  pop: Pop
  reducedMotion: boolean
  onDone: (id: number) => void
}) {
  const { x, y, value, tone, heated, motion: path } = pop
  const crit = tone === 'crit'
  const done = () => onDone(pop.id)
  const { durationS } = path

  // Mouvement réduit : le nombre apparaît sur place, puis s'efface.
  const flight = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: [0, 1, 1, 0] } }
    : { initial: { x: 0, y: 0 }, animate: { x: path.dx, y: -path.rise } }
  // Jaillissement : gonfle au-delà de sa taille, se pose, puis s'efface en rapetissant.
  const burst = reducedMotion
    ? undefined
    : crit
      ? {
          initial: { scale: 0.3, opacity: 0, rotate: path.tilt },
          animate: {
            scale: [0.3, 1.75, 1, 1.06, 0.9],
            opacity: [0, 1, 1, 1, 0],
            rotate: [path.tilt, -path.tilt * 0.35, 0, 0, 0],
          },
        }
      : {
          initial: { scale: 0.4, opacity: 0 },
          animate: { scale: [0.4, 1.3, 1, 1, 0.9], opacity: [0, 1, 1, 1, 0] },
        }

  return (
    <motion.div
      data-slot="score-pop"
      data-tone={tone}
      data-heated={heated || undefined}
      className="absolute size-0 overflow-visible"
      style={{ left: x, top: y }}
      {...flight}
      transition={
        reducedMotion
          ? { duration: 0.9, times: [0, 0.15, 0.7, 1] }
          : { duration: durationS, ease: ease.outQuart }
      }
      onAnimationComplete={done}
    >
      <motion.span
        data-slot="score-pop-value"
        className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center leading-none font-black tracking-tight whitespace-nowrap tabular-nums"
        style={{ fontSize: path.fontSize, filter: popFilter(crit, heated) }}
        {...burst}
        transition={{
          duration: durationS,
          times: crit ? [0, 0.12, 0.3, 0.75, 1] : [0, 0.12, 0.3, 0.72, 1],
          ease: 'easeOut',
        }}
      >
        {crit && (
          <span
            data-slot="score-pop-crit"
            className="mb-[0.12em] text-[0.36em] font-extrabold tracking-[0.2em] uppercase"
            style={{ color: 'var(--coin)' }}
          >
            Critique
          </span>
        )}
        <span style={TONE_STYLE[tone]}>{formatScore(value)}</span>
      </motion.span>
    </motion.div>
  )
}
