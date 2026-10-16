import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useReducedMotion } from 'motion/react'

import { BOSS_RULES } from '@/game/config'
import {
  ghostProgress,
  lerpPoint,
  targetOpacity,
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
/** Durée du rappel d'une frappe sans effet (« Trop tôt », « Trop tard », « Erreur » sur une note bonus) (ms). */
const HINT_MS = 600

/** Frappe sans jugement : sa raison, et le temps écoulé depuis (ms). */
type Hint = { reason: NonNullable<BossState['lastIgnored']>['reason']; since: number }
const HINT_LABEL: Record<Hint['reason'], string> = {
  early: 'Trop tôt',
  late: 'Trop tard',
  wrong: 'Erreur',
}
const HINT_COLOR: Record<Hint['reason'], string> = {
  early: 'var(--muted-foreground)',
  late: 'var(--muted-foreground)',
  wrong: 'var(--feedback-error)',
}
/** Portée du masque au-dessus du sol et sur les côtés (px) : bien au-delà de l'écran. */
const CLIP_REACH = 10_000
/** Apparition de la cible et de son couloir (ms). */
const APPEAR_MS = 200
/** Halo du fantôme, en rayons de note : le départ se fait sous lui, hors de l'écran. */
const GHOST_HALO = 1.7
/** Fantômes et couloirs des notes en vol après celle à jouer : atténués. */
const UPCOMING_OPACITY = 0.45
/** Une note bonus à venir, elle, reste vive : elle doit sauter aux yeux. */
const UPCOMING_BONUS_OPACITY = 0.85
/** Montée d'un cran des anneaux d'arrivée, à chaque jugement (ms). */
const RANK_EASE_MS = 200

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

/** Notes bonus : le jaune du coup de pouce, pour fantôme, couloir et anneau. */
const BONUS_COLOR = 'var(--assist)'

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
  /**
   * Élément posé sous le manche (le piano, sur écran tactile) : les fantômes
   * partent toujours du bas de l'écran, à la même allure, mais restent cachés
   * sous son bord haut, d'où ils semblent jaillir. Absent, rien ne les masque.
   */
  floorRef?: RefObject<HTMLElement | null>
}

/**
 * Couloirs et fantômes du boss final, posés sur le manche (calque `overlay`, en
 * px). Chaque note, sitôt partie, montre sa cible (un anneau) ; son fantôme
 * monte du bas de l'écran le long d'un couloir vertical jusqu'à l'anneau, qu'il
 * touche pile au moment de frapper ; manqué, il le dépasse et s'efface.
 * Plusieurs notes sont en vol à la fois : celle à jouer est au premier plan, les
 * suivantes atténuées. Une étiquette dit le jugement, au-dessus de la révélation.
 * Les notes bonus, plus rapides, sont jaunes. Une frappe sans effet le dit sur
 * la note visée : « Trop tôt » avant sa fenêtre, « Trop tard » sur une note
 * déjà manquée, « Erreur » sur une note bonus, qui se retente une fois.
 */
export function BossLayer({ state, layout, projection, floorRef }: BossLayerProps): ReactNode {
  // Combat suspendu : l'image se fige à l'instant de la suspension.
  const runUntil =
    state.suspendedAt !== null
      ? 0
      : state.phase === 'playing'
        ? Number.POSITIVE_INFINITY
        : state.endedAt !== null
          ? state.endedAt + LINGER_MS
          : 0
  const frameNow = useFrameClock(runUntil)
  const now = state.suspendedAt ?? frameNow
  const reduceMotion = useReducedMotion() ?? false

  // Bas de l'écran, dans le repère du calque : le départ des fantômes. Et le
  // bord haut du sol (piano), sous lequel ils restent cachés.
  const svgRef = useRef<SVGSVGElement>(null)
  const clipId = useId()
  const [bottom, setBottom] = useState(0)
  const [floor, setFloor] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const svg = svgRef.current
      if (!svg) return
      const top = svg.getBoundingClientRect().top
      setBottom(window.innerHeight - top)
      const ground = floorRef?.current
      setFloor(ground ? ground.getBoundingClientRect().top - top : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [projection.width, projection.height, floorRef])

  // Notes en vol et notes jugées le temps de leurs retours ; celle à jouer
  // dessinée en dernier, par-dessus les autres.
  const shown = visibleBossNotes(state, now, Math.max(LABEL_MS, BOSS_RULES.fadeMs))
  // Dernière frappe sans effet, rappelée un instant sur la note qu'elle visait.
  const ignored = state.lastIgnored
  const hintFor =
    ignored && now - ignored.at < HINT_MS ? (state.notes[ignored.index]?.id ?? null) : null
  // « Trop tard » vise une note manquée, parfois déjà effacée : elle reste là
  // le temps du rappel, qui seul s'y voit encore.
  if (ignored?.reason === 'late' && hintFor !== null && !shown.some((v) => v.note.id === hintFor)) {
    const hit = state.hits[ignored.index]
    if (hit) shown.push({ note: state.notes[ignored.index], hit, current: false, rank: -1 })
  }
  shown.sort((a, b) => Number(a.current) - Number(b.current))

  return (
    <svg
      ref={svgRef}
      data-slot="boss-layer"
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={projection.width}
      height={projection.height}
    >
      {floor !== null && (
        <defs>
          <clipPath id={clipId}>
            {/* Tout ce qui est au-dessus du sol, étiquettes comprises, sans limite. */}
            <rect
              x={-CLIP_REACH}
              y={-CLIP_REACH}
              width={CLIP_REACH * 2}
              height={floor + CLIP_REACH}
            />
          </clipPath>
        </defs>
      )}
      <g clipPath={floor !== null ? `url(#${clipId})` : undefined}>
        {shown.map(({ note, hit, current, rank }) => (
          <BossNoteView
            key={note.id}
            note={note}
            hit={hit}
            current={current}
            rank={rank}
            // Depuis le dernier jugement, chaque anneau en vol monte d'un cran.
            sinceAdvance={state.lastHit ? now - state.lastHit.at : Number.POSITIVE_INFINITY}
            // « Trop tard » vise une note déjà manquée ; les autres, une note encore à jouer.
            hint={
              note.id === hintFor && ignored && (hit === null) === (ignored.reason !== 'late')
                ? { reason: ignored.reason, since: now - ignored.at }
                : null
            }
            now={now}
            bottom={bottom}
            layout={layout}
            projection={projection}
            reduceMotion={reduceMotion}
          />
        ))}
      </g>
    </svg>
  )
}

function BossNoteView({
  note,
  hit,
  current,
  rank,
  sinceAdvance,
  hint,
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
  /** Rang dans la file des notes en vol (0 : à jouer) ; -1 si jugée. */
  rank: number
  /** Temps écoulé depuis le dernier jugement, qui a fait monter la file d'un cran (ms). */
  sinceAdvance: number
  /** Frappe sans effet sur cette note, à rappeler (`null` sinon). */
  hint: Hint | null
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
  const bonus = note.bonus === true
  const tint = bonus ? BONUS_COLOR : 'var(--boss-ghost)'

  // Le fantôme : consommé par une frappe ; manqué, il poursuit sa course au-delà
  // de la cible en s'effaçant. Passé sa cible, il file à l'allure d'une note
  // ordinaire : une note bonus, plus rapide, reste ainsi près de son anneau tant
  // que sa fenêtre, plus longue, est ouverte.
  const ghostOpacity =
    hit === null ? 1 : hit.judgement === 'miss' ? clamp01(1 - since / BOSS_RULES.fadeMs) : 0
  const ghostPx = lerpPoint(launchPx, targetPx, ghostProgress(note, now, BOSS_RULES.travelMs))

  // En attente de leur tour, fantôme et couloir des notes suivantes restent en retrait.
  const presence =
    hit === null && !current ? (bonus ? UPCOMING_BONUS_OPACITY : UPCOMING_OPACITY) : 1
  // Anneau d'arrivée : opacité dégressive selon le rang (100, 50, 25 %), qui
  // passe en un bref fondu au cran supérieur à chaque jugement.
  const ringRank =
    rank < 0
      ? 1
      : targetOpacity(rank + 1) +
        (targetOpacity(rank) - targetOpacity(rank + 1)) * clamp01(sinceAdvance / RANK_EASE_MS)

  return (
    <g
      data-slot="boss-note"
      data-judgement={hit?.judgement}
      data-current={current || undefined}
      data-rank={rank >= 0 ? rank : undefined}
      data-string={note.stringIndex}
      data-fret={note.fret}
      data-bonus={bonus || undefined}
    >
      <line
        data-slot="boss-lane"
        x1={launchPx.x}
        y1={launchPx.y}
        x2={targetPx.x}
        y2={targetPx.y}
        stroke={tint}
        strokeOpacity={(bonus ? 0.4 : 0.22) * appear * fade * presence}
        strokeWidth={r * 0.18}
        strokeLinecap="round"
      />
      <circle
        data-slot="boss-target"
        cx={targetPx.x}
        cy={targetPx.y}
        // Réussie, la cible s'ouvre comme une onde en s'effaçant.
        r={r * (1 + (success && !reduceMotion ? clamp01(since / LABEL_MS) * 0.9 : 0))}
        fill={bonus ? BONUS_COLOR : 'var(--marker)'}
        fillOpacity={0.14 * appear * fade * ringRank}
        stroke={
          hit
            ? bonus && success
              ? BONUS_COLOR
              : COLOR[hit.judgement]
            : bonus
              ? BONUS_COLOR
              : 'var(--marker)'
        }
        strokeWidth={r * (current ? 0.26 : 0.2)}
        strokeOpacity={appear * ringRank * (success ? clamp01(1 - since / LABEL_MS) : fade)}
      />
      {ghostOpacity > 0 && (
        <g data-slot="boss-ghost" opacity={ghostOpacity * presence}>
          <circle
            cx={ghostPx.x}
            cy={ghostPx.y}
            r={r * GHOST_HALO}
            fill={bonus ? BONUS_COLOR : 'var(--marker-halo)'}
            opacity={bonus ? 0.3 : 0.45}
          />
          <circle
            cx={ghostPx.x}
            cy={ghostPx.y}
            r={r * 0.9}
            fill={tint}
            // Liseré du fond de page : lisible sur la touche comme hors du manche.
            stroke="var(--background)"
            strokeWidth={r * 0.14}
          />
        </g>
      )}
      {hint && (
        <text
          data-slot="boss-hint"
          data-reason={hint.reason}
          x={targetPx.x}
          y={targetPx.y - r * 2.2 - (reduceMotion ? 0 : (hint.since / HINT_MS) * r * 0.8)}
          textAnchor="middle"
          fontSize={Math.max(11, r * 1.05)}
          fontWeight={700}
          fill={HINT_COLOR[hint.reason]}
          opacity={clamp01(1 - hint.since / HINT_MS)}
          stroke="var(--background)"
          strokeWidth={Math.max(2, r * 0.25)}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {HINT_LABEL[hint.reason]}
        </text>
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
          fill={bonus && success ? BONUS_COLOR : COLOR[hit.judgement]}
          opacity={clamp01(1 - since / LABEL_MS)}
          stroke="var(--background)"
          strokeWidth={Math.max(2, r * 0.3)}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {bonus && success ? `Bonus ×${hit.multiplier}` : LABEL[hit.judgement]}
        </text>
      )}
    </g>
  )
}
