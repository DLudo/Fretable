import { useEffect, useState, type ReactNode } from 'react'

import { BOSS_RULES } from '@/game/config'
import {
  ghostY,
  laneFor,
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
const APPEAR_MS = 250
/** Le fantôme s'allume sur ses premiers millimètres de couloir. */
const IGNITE_MM = 4

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
 * Couloirs et fantômes du boss final, posés sur le manche (calque `overlay`,
 * en px). Chaque note paraît `leadMs` avant son instant : sa cible (un anneau)
 * et son couloir, qui part de sous le manche. Le fantôme y monte à vitesse
 * constante et touche l'anneau pile au moment de frapper ; manqué, il le
 * dépasse et s'efface. Une étiquette dit le jugement.
 */
export function BossLayer({ state, layout, projection }: BossLayerProps): ReactNode {
  const runUntil =
    state.phase === 'playing'
      ? Number.POSITIVE_INFINITY
      : state.endedAt !== null
        ? state.endedAt + LINGER_MS
        : 0
  const now = useFrameClock(runUntil)

  const shown: { note: BossNote; hit: BossHit | null }[] = []
  state.notes.forEach((note, index) => {
    const hit = state.hits[index]
    if (now < note.hitAt - BOSS_RULES.leadMs) return
    if (!hit && state.phase !== 'playing') return
    if (hit && now - hit.at > Math.max(LABEL_MS, BOSS_RULES.fadeMs)) return
    shown.push({ note, hit })
  })

  return (
    <svg
      data-slot="boss-layer"
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={projection.width}
      height={projection.height}
    >
      {shown.map(({ note, hit }) => (
        <BossNoteView
          key={note.id}
          note={note}
          hit={hit}
          now={now}
          layout={layout}
          projection={projection}
        />
      ))}
    </svg>
  )
}

function BossNoteView({
  note,
  hit,
  now,
  layout,
  projection,
}: {
  note: BossNote
  hit: BossHit | null
  now: number
  layout: NeckLayout
  projection: BoardProjection
}) {
  const { target, launch } = laneFor(layout, note)
  const targetPx = projection.toPx(target)
  const launchPx = projection.toPx(launch)
  const r = layout.markerRadius * projection.pxPerMm

  const appear = clamp01((now - (note.hitAt - BOSS_RULES.leadMs)) / APPEAR_MS)
  const since = hit ? now - hit.at : 0
  // Jugée, la note s'efface : couloir et anneau en quelques dixièmes de seconde.
  const fade = hit ? clamp01(1 - since / 350) : 1
  const success = hit !== null && isSuccess(hit.judgement)

  // Le fantôme : invisible sous la zone de lancement, consommé par une frappe,
  // il poursuit sa course au-delà de la cible s'il est manqué, en s'effaçant.
  const y = ghostY(target, note.hitAt, now)
  const ignite = clamp01((launch.y - y) / IGNITE_MM)
  const ghostOpacity =
    hit === null
      ? ignite
      : hit.judgement === 'miss'
        ? ignite * clamp01(1 - since / BOSS_RULES.fadeMs)
        : 0
  const ghostPx = projection.toPx({ x: target.x, y })

  return (
    <g data-slot="boss-note" data-judgement={hit?.judgement}>
      <line
        data-slot="boss-lane"
        x1={launchPx.x}
        y1={launchPx.y}
        x2={targetPx.x}
        y2={targetPx.y}
        stroke="var(--marker)"
        strokeOpacity={0.28 * appear * fade}
        strokeWidth={r * 0.18}
        strokeLinecap="round"
      />
      <circle
        data-slot="boss-launch"
        cx={launchPx.x}
        cy={launchPx.y}
        r={r * 0.28}
        fill="var(--marker)"
        opacity={0.4 * appear * fade}
      />
      <circle
        data-slot="boss-target"
        cx={targetPx.x}
        cy={targetPx.y}
        // Réussie, la cible s'ouvre comme une onde en s'effaçant.
        r={r * (1 + (success ? clamp01(since / LABEL_MS) * 0.9 : 0))}
        fill="var(--marker)"
        fillOpacity={0.14 * appear * fade}
        stroke={hit ? COLOR[hit.judgement] : 'var(--marker)'}
        strokeWidth={r * 0.22}
        strokeOpacity={appear * (success ? clamp01(1 - since / LABEL_MS) : fade)}
      />
      {ghostOpacity > 0 && (
        <g data-slot="boss-ghost" opacity={ghostOpacity}>
          <circle
            cx={ghostPx.x}
            cy={ghostPx.y}
            r={r * 1.7}
            fill="var(--marker-halo)"
            opacity={0.45}
          />
          <circle cx={ghostPx.x} cy={ghostPx.y} r={r * 0.9} fill="var(--marker)" />
        </g>
      )}
      {hit && since < LABEL_MS && (
        <text
          data-slot="boss-label"
          x={targetPx.x}
          y={targetPx.y - r * 2.1 - (since / LABEL_MS) * r * 1.2}
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
