import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

import { BOSS_RULES } from '@/game/config'
import {
  ghostProgress,
  lerpPoint,
  visibleBossNotes,
  type BossHit,
  type BossJudgement,
  type BossNote,
  type BossState,
} from '@/game/boss'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'

/** Après la fin du combat, les derniers retours se jouent encore (ms). */
const LINGER_MS = 900
/** Durée de l'étiquette de jugement (ms). */
const LABEL_MS = 700
/** Apparition de la cible et de son couloir (ms). */
const APPEAR_MS = 200
/** Halo du fantôme, en rayons de note : le départ se fait sous lui, hors de l'écran. */
const GHOST_HALO = 1.7
/** Notes en vol après celle à jouer : atténuées, pour qu'on lise l'ordre d'arrivée. */
const UPCOMING_OPACITY = 0.45

const LABEL: Record<BossJudgement, string> = {
  perfect: 'Parfait',
  great: 'Super',
  good: 'Bien',
  wrong: 'Erreur',
  miss: 'Raté',
}

const COLOR: Record<BossJudgement, string> = {
  perfect: 'var(--triad)',
  great: 'var(--combo)',
  good: 'var(--marker)',
  wrong: 'var(--feedback-error)',
  miss: 'var(--muted-foreground)',
}

const isSuccess = (judgement: BossJudgement) =>
  judgement === 'perfect' || judgement === 'great' || judgement === 'good'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Horloge d'affichage : l'instant de chaque image (`performance.now()`) tant
 * qu'il reste avant `runUntil`. Seule cette couche se redessine à chaque image.
 */
function useFrameClock(runUntil: number): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t)
      if (t < runUntil) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [runUntil])
  return now
}

export interface BossLayerProps {
  state: BossState
  layout: NeckLayout
  projection: BoardProjection
}

/**
 * Couloirs et fantômes du boss final, posés sur le manche (calque `overlay`, en
 * px). Chaque note, sitôt partie, montre sa cible (un anneau) ; son fantôme
 * monte du bas de l'écran le long d'un couloir vertical jusqu'à l'anneau, qu'il
 * touche pile au moment de frapper ; manqué, il le dépasse et s'efface.
 * Plusieurs notes sont en vol à la fois : celle à jouer est au premier plan, les
 * suivantes atténuées. Une étiquette dit le jugement, au-dessus de la révélation.
 */
export function BossLayer({ state, layout, projection }: BossLayerProps): ReactNode {
  const runUntil =
    state.phase === 'playing'
      ? Number.POSITIVE_INFINITY
      : state.endedAt !== null
        ? state.endedAt + LINGER_MS
        : 0
  const now = useFrameClock(runUntil)
  const reduceMotion = useReducedMotion() ?? false

  // Bas de l'écran, dans le repère du calque : le départ des fantômes.
  const svgRef = useRef<SVGSVGElement>(null)
  const [bottom, setBottom] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const svg = svgRef.current
      if (svg) setBottom(window.innerHeight - svg.getBoundingClientRect().top)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [projection.width, projection.height])

  // Notes en vol et notes jugées le temps de leurs retours ; celle à jouer
  // dessinée en dernier, par-dessus les autres.
  const shown = visibleBossNotes(state, now, Math.max(LABEL_MS, BOSS_RULES.fadeMs)).sort(
    (a, b) => Number(a.current) - Number(b.current),
  )

  return (
    <svg
      ref={svgRef}
      data-slot="boss-layer"
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={projection.width}
      height={projection.height}
    >
      {shown.map(({ note, hit, current }) => (
        <BossNoteView
          key={note.id}
          note={note}
          hit={hit}
          current={current}
          now={now}
          bottom={bottom}
          layout={layout}
          projection={projection}
          reduceMotion={reduceMotion}
        />
      ))}
    </svg>
  )
}

function BossNoteView({
  note,
  hit,
  current,
  now,
  bottom,
  layout,
  projection,
  reduceMotion,
}: {
  note: BossNote
  hit: BossHit | null
  /** La note à jouer maintenant ; les autres notes en vol sont atténuées. */
  current: boolean
  now: number
  /** Bas de l'écran, en px depuis le haut du calque. */
  bottom: number
  layout: NeckLayout
  projection: BoardProjection
  /** Animations réduites : ni onde ni étiquette qui monte, de simples fondus. */
  reduceMotion: boolean
}) {
  const r = layout.markerRadius * projection.pxPerMm
  const targetPx = projection.toPx(layout.position(note.stringIndex, note.fret))
  // Départ juste sous le bord de l'écran, halo compris : le fantôme y entre par le bas.
  const launchPx = { x: targetPx.x, y: Math.max(bottom + r * GHOST_HALO, targetPx.y) }

  const appear = clamp01((now - note.launchAt) / APPEAR_MS)
  const since = hit ? now - hit.at : 0
  // Jugée, la note s'efface : couloir et anneau en quelques dixièmes de seconde.
  const fade = hit ? clamp01(1 - since / 300) : 1
  const success = hit !== null && isSuccess(hit.judgement)

  // Le fantôme : consommé par une frappe ; manqué, il poursuit sa course au-delà
  // de la cible en s'effaçant.
  const ghostOpacity =
    hit === null ? 1 : hit.judgement === 'miss' ? clamp01(1 - since / BOSS_RULES.fadeMs) : 0
  const ghostPx = lerpPoint(launchPx, targetPx, ghostProgress(note, now))

  // En attente de leur tour, les notes suivantes restent en retrait.
  const presence = hit === null && !current ? UPCOMING_OPACITY : 1

  return (
    <g
      data-slot="boss-note"
      data-judgement={hit?.judgement}
      data-current={current || undefined}
      opacity={presence}
    >
      <line
        data-slot="boss-lane"
        x1={launchPx.x}
        y1={launchPx.y}
        x2={targetPx.x}
        y2={targetPx.y}
        stroke="var(--boss-ghost)"
        strokeOpacity={0.22 * appear * fade}
        strokeWidth={r * 0.18}
        strokeLinecap="round"
      />
      <circle
        data-slot="boss-target"
        cx={targetPx.x}
        cy={targetPx.y}
        // Réussie, la cible s'ouvre comme une onde en s'effaçant.
        r={r * (1 + (success && !reduceMotion ? clamp01(since / LABEL_MS) * 0.9 : 0))}
        fill="var(--marker)"
        fillOpacity={0.14 * appear * fade}
        stroke={hit ? COLOR[hit.judgement] : 'var(--marker)'}
        strokeWidth={r * (current ? 0.26 : 0.2)}
        strokeOpacity={appear * (success ? clamp01(1 - since / LABEL_MS) : fade)}
      />
      {ghostOpacity > 0 && (
        <g data-slot="boss-ghost" opacity={ghostOpacity}>
          <circle
            cx={ghostPx.x}
            cy={ghostPx.y}
            r={r * GHOST_HALO}
            fill="var(--marker-halo)"
            opacity={0.45}
          />
          <circle
            cx={ghostPx.x}
            cy={ghostPx.y}
            r={r * 0.9}
            fill="var(--boss-ghost)"
            // Liseré du fond de page : lisible sur la touche comme hors du manche.
            stroke="var(--background)"
            strokeWidth={r * 0.14}
          />
        </g>
      )}
      {hit && since < LABEL_MS && (
        <text
          data-slot="boss-label"
          x={targetPx.x}
          // Au-dessus de la révélation de la note (étiquette centrée sur la cible).
          y={targetPx.y - r * 3.4 - (reduceMotion ? 0 : (since / LABEL_MS) * r * 1.2)}
          textAnchor="middle"
          fontSize={Math.max(12, r * 1.35)}
          fontWeight={800}
          fill={COLOR[hit.judgement]}
          opacity={clamp01(1 - since / LABEL_MS)}
          stroke="var(--background)"
          strokeWidth={Math.max(2, r * 0.3)}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {LABEL[hit.judgement]}
        </text>
      )}
    </g>
  )
}
