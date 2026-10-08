import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  buildRevealProps,
  DEFAULT_MAX_DURATION_MS,
  listEffects,
  revealBudgetMs,
  revealCapMs,
  RevealEffectHost,
  revealGeometry,
  revealSeed,
  type RevealGeometry,
} from '@/effects'
import type { RevealEffect, RevealOutcome } from '@/effects/types'
import { COMBO_RULES, GAME_FEEL } from '@/game/config'
import { createNeckLayout, type NeckLayout, type Point } from '@/game/fretboard/geometry'
import {
  ORIENTATION_TRANSFORM,
  orientPoint,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { NOTES, toPitchClass, type PitchClass } from '@/game/music/notes'
import { useElementSize } from '@/hooks/useElementSize'

/**
 * Lab d'effets — banc d'essai isolé pour concevoir et régler les révélations,
 * à l'échelle exacte du jeu (mêmes props, même graine, même géométrie).
 * Accès : `/?lab`. Paramètres facultatifs pour l'automatisation :
 *   `effect=<id>` `outcome=correct|wrong` `streak=<n>` `label=<texte>` `autoplay=1` `delay=<ms>`
 *   `marker=desktop|paysage|portrait` `string=<1-6>` `fret=<1-12>` `reduced=1` `timeout=1`
 */

interface MarkerPreset {
  name: string
  /** Échelle du manche relevée en jeu pour ce format d'écran. */
  pxPerMm: number
  orientation: BoardOrientation
}

/** Formats d'écran types : le repère y mesure ≈ 21, 14 et 10 px. */
const MARKER_PRESETS = {
  desktop: { name: 'Bureau', pxPerMm: 3.38, orientation: 'horizontal' },
  paysage: { name: 'Paysage', pxPerMm: 2.25, orientation: 'horizontal' },
  portrait: { name: 'Portrait', pxPerMm: 1.6, orientation: 'vertical' },
} as const satisfies Record<string, MarkerPreset>

type MarkerId = keyof typeof MARKER_PRESETS

const isMarkerId = (value: string | null): value is MarkerId =>
  value !== null && Object.hasOwn(MARKER_PRESETS, value)

/** Sel fixe : une même suite de clics rejoue exactement les mêmes variantes. */
const LAB_SALT = 0

const LAYOUT = createNeckLayout()

const params = new URLSearchParams(window.location.search)

const clampInt = (value: string | null, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value ?? NaN))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const STRING_COUNT = LAYOUT.tuning.strings.length
/** Position de la note : corde 3 (Sol), case 5 par défaut, au milieu des frettes. */
const STRING_INDEX = STRING_COUNT - clampInt(params.get('string'), 1, STRING_COUNT, 3)
const FRET = clampInt(params.get('fret'), 1, LAYOUT.spec.lastFret, 5)

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Projection du manche centrée sur la note : le repère tombe au centre de la scène. */
function stageProjection(
  size: { width: number; height: number },
  preset: MarkerPreset,
  anchor: Point,
): BoardProjection {
  const center = orientPoint(anchor, preset.orientation)
  return {
    pxPerMm: preset.pxPerMm,
    width: size.width,
    height: size.height,
    orientation: preset.orientation,
    toPx: (point) => {
      const p = orientPoint(point, preset.orientation)
      return {
        x: size.width / 2 + (p.x - center.x) * preset.pxPerMm,
        y: size.height / 2 + (p.y - center.y) * preset.pxPerMm,
      }
    },
  }
}

/** Réglages figés au lancement d'un essai. */
interface Run {
  key: number
  effect: RevealEffect
  outcome: RevealOutcome
  streak: number
  label: string
  pc: PitchClass
  reducedMotion: boolean
  timedOut: boolean
  /** Multiplicateur de points : 2 pour simuler un combo. */
  multiplier: number
  startedAt: number
}

/** Dernière mesure d'un effet : durée réelle (null = encore en cours) et limite du jeu. */
interface Measure {
  ms: number | null
  capMs: number
}

export default function EffectsLab() {
  const [streak, setStreak] = useState(() => clampInt(params.get('streak'), 0, 99, 1))
  const [label, setLabel] = useState(() => params.get('label') ?? 'Sol♯')
  const [marker, setMarker] = useState<MarkerId>(() => {
    const value = params.get('marker')
    return isMarkerId(value) ? value : 'desktop'
  })
  const [reducedMotion, setReducedMotion] = useState(() =>
    params.has('reduced') ? params.get('reduced') === '1' : prefersReducedMotion(),
  )
  const [timedOut, setTimedOut] = useState(() => params.get('timeout') === '1')
  const [combo, setCombo] = useState(() => params.get('combo') === '1')
  const [runs, setRuns] = useState<Run[]>([])
  const [measures, setMeasures] = useState<Record<string, Measure>>({})
  const counter = useRef(0)
  const effects = useMemo(() => listEffects(), [])
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const preset = MARKER_PRESETS[marker]

  const geometry = useMemo<RevealGeometry | null>(() => {
    if (stage.width === 0) return null
    const anchor = LAYOUT.position(STRING_INDEX, FRET)
    return revealGeometry(LAYOUT, stageProjection(stage, preset, anchor), STRING_INDEX, FRET)
  }, [stage, preset])

  const play = useCallback(
    (effect: RevealEffect, outcome: RevealOutcome) => {
      const key = ++counter.current
      const pc = NOTES.find((n) => n.solfege === label)?.pc ?? 8
      const run: Run = {
        key,
        effect,
        outcome,
        streak: outcome === 'correct' ? streak : 0,
        label,
        pc,
        reducedMotion,
        timedOut: outcome === 'wrong' && timedOut,
        multiplier: combo ? COMBO_RULES.multiplier : 1,
        startedAt: performance.now(),
      }
      setRuns((list) => [...list, run])
    },
    [label, streak, reducedMotion, timedOut, combo],
  )

  // Un effet peut appeler `onComplete` plusieurs fois : seul le premier appel compte.
  const finished = useRef(new Set<number>())
  const finish = useCallback((run: Run, ms: number, capMs: number) => {
    if (finished.current.has(run.key)) return
    finished.current.add(run.key)
    setRuns((list) => list.filter((r) => r.key !== run.key))
    setMeasures((all) => ({ ...all, [run.effect.id]: { ms, capMs } }))
  }, [])

  const overrun = useCallback((run: Run, capMs: number) => {
    if (finished.current.has(run.key)) return
    setMeasures((all) => ({ ...all, [run.effect.id]: { ms: null, capMs } }))
  }, [])

  const chooseMarker = (id: MarkerId) => {
    setMarker(id)
    setRuns([])
    const url = new URL(window.location.href)
    url.searchParams.set('marker', id)
    window.history.replaceState(null, '', url)
  }

  // Lecture automatique, une seule fois, dès que la scène est mesurée.
  const autoplay = useRef(params.get('autoplay') === '1')
  useEffect(() => {
    if (!autoplay.current || !geometry) return
    const id = params.get('effect')
    const outcome: RevealOutcome = params.get('outcome') === 'wrong' ? 'wrong' : 'correct'
    const effect =
      effects.find((e) => e.id === id) ?? effects.find((e) => e.outcomes.includes(outcome))
    if (!effect) return
    const timer = window.setTimeout(
      () => {
        autoplay.current = false
        play(effect, outcome)
      },
      Number(params.get('delay') ?? 300),
    )
    return () => window.clearTimeout(timer)
  }, [effects, play, geometry])

  const markerPx = LAYOUT.markerRadius * 2 * preset.pxPerMm

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Lab d’effets</h1>
        <Badge variant="secondary">{effects.length} effets enregistrés</Badge>
        <a
          className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
          href="./"
        >
          Retour au jeu
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div role="group" aria-label="Format d'écran" className="flex items-center gap-1">
          {(Object.keys(MARKER_PRESETS) as MarkerId[]).map((id) => (
            <Button
              key={id}
              size="sm"
              variant={id === marker ? 'secondary' : 'ghost'}
              aria-pressed={id === marker}
              data-slot="lab-marker-preset"
              onClick={() => chooseMarker(id)}
            >
              {MARKER_PRESETS[id].name}
            </Button>
          ))}
          <span className="ml-1 text-muted-foreground tabular-nums">
            repère ≈ {Math.round(markerPx)} px
          </span>
        </div>
        <label className="flex items-center gap-2">
          Série
          <input
            type="range"
            className="accent-foreground"
            min={0}
            max={GAME_FEEL.maxStreakIntensity + 2}
            value={streak}
            onChange={(e) => setStreak(Number(e.target.value))}
          />
          <span className="w-6 tabular-nums">{streak}</span>
        </label>
        <label className="flex items-center gap-2">
          Note
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          >
            {!NOTES.some((n) => n.solfege === label) && <option>{label}</option>}
            {NOTES.map((n) => (
              <option key={n.pc}>{n.solfege}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
          Mouvement réduit
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={timedOut}
            onChange={(e) => setTimedOut(e.target.checked)}
          />
          Temps écoulé (faux)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={combo}
            onChange={(e) => setCombo(e.target.checked)}
          />
          Combo (×{COMBO_RULES.multiplier})
        </label>
      </div>

      <div
        data-slot="lab-stage"
        data-orientation={preset.orientation}
        className="relative h-64 overflow-visible rounded-xl border bg-card"
      >
        <div ref={stageRef} className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {geometry && (
            <StageNeck layout={LAYOUT} size={stage} preset={preset} hideMarker={runs.length > 0} />
          )}
        </div>
        {geometry &&
          runs.map((run) => (
            <StageEffect
              key={run.key}
              run={run}
              geometry={geometry}
              onDone={finish}
              onOverrun={overrun}
            />
          ))}
        {runs.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2"
            onClick={() => setRuns([])}
          >
            Vider
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Note suivante après {revealBudgetMs('correct')} ms (juste) · {revealBudgetMs('wrong')} ms
        (faux) · écran de fin {revealBudgetMs('wrong', true)} ms (temps écoulé). Limite de vie par
        défaut : {DEFAULT_MAX_DURATION_MS} ms.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {effects.map((effect) => {
          const measure = measures[effect.id]
          const over = measure !== undefined && (measure.ms === null || measure.ms > measure.capMs)
          return (
            <div
              key={effect.id}
              data-slot="lab-effect"
              data-effect={effect.id}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <div className="mr-auto">
                  <div className="text-sm font-medium">{effect.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{effect.id}</div>
                </div>
                {effect.outcomes.map((outcome) => (
                  <Button
                    key={outcome}
                    size="sm"
                    variant={outcome === 'correct' ? 'secondary' : 'outline'}
                    onClick={() => play(effect, outcome)}
                  >
                    {outcome === 'correct' ? 'Juste' : 'Faux'}
                  </Button>
                ))}
              </div>
              {measure && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {measure.ms === null ? 'en cours…' : `${Math.round(measure.ms)} ms`}
                  </span>
                  {over && (
                    <span
                      data-slot="lab-overrun"
                      className="flex items-center gap-1 text-destructive"
                    >
                      <TriangleAlert className="size-3.5" aria-hidden />
                      dépasse {measure.capMs} ms : coupé en jeu
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Manche simplifié (bois, sillet, frettes, repères, cordes) à l'échelle du format choisi. */
function StageNeck({
  layout,
  size,
  preset,
  hideMarker,
}: {
  layout: NeckLayout
  size: { width: number; height: number }
  preset: MarkerPreset
  hideMarker: boolean
}) {
  const anchor = layout.position(STRING_INDEX, FRET)
  const transform = [
    `translate(${size.width / 2} ${size.height / 2})`,
    `scale(${preset.pxPerMm})`,
    ORIENTATION_TRANSFORM[preset.orientation] ?? '',
    `translate(${-anchor.x} ${-anchor.y})`,
  ].join(' ')
  const { outline, nut, frets, inlays, strings, spec } = layout
  return (
    <svg data-slot="lab-neck" className="absolute inset-0 size-full" aria-hidden>
      <g transform={transform}>
        <polygon
          className="fill-fretboard"
          points={outline.map((p) => `${p.x},${p.y}`).join(' ')}
        />
        <rect
          className="fill-nut"
          x={nut.x0}
          y={-nut.halfWidth}
          width={nut.x1 - nut.x0}
          height={nut.halfWidth * 2}
        />
        {inlays.map((inlay) => (
          <circle
            key={`${inlay.fret}-${inlay.center.y}`}
            className="fill-inlay"
            cx={inlay.center.x}
            cy={inlay.center.y}
            r={inlay.r}
          />
        ))}
        {frets.map((fret) => (
          <line
            key={fret.n}
            className="stroke-fret-wire"
            strokeWidth={spec.fretWireWidth}
            x1={fret.x}
            x2={fret.x}
            y1={-fret.halfWidth}
            y2={fret.halfWidth}
          />
        ))}
        {strings.map((string) => (
          <line
            key={string.index}
            className={string.wound ? 'stroke-string-wound' : 'stroke-string'}
            strokeWidth={string.gauge}
            x1={string.from.x}
            y1={string.from.y}
            x2={string.to.x}
            y2={string.to.y}
          />
        ))}
        {!hideMarker && (
          <circle
            data-slot="lab-marker"
            className="fill-marker"
            cx={anchor.x}
            cy={anchor.y}
            r={layout.markerRadius}
          />
        )}
      </g>
    </svg>
  )
}

function StageEffect({
  run,
  geometry,
  onDone,
  onOverrun,
}: {
  run: Run
  geometry: RevealGeometry
  onDone: (run: Run, ms: number, capMs: number) => void
  onOverrun: (run: Run, capMs: number) => void
}) {
  const correct = run.outcome === 'correct'
  const capMs = revealCapMs(run.effect, {
    reducedMotion: run.reducedMotion,
    budgetMs: revealBudgetMs(run.outcome, run.timedOut),
  })
  const complete = useCallback(
    () => onDone(run, performance.now() - run.startedAt, capMs),
    [onDone, run, capMs],
  )

  const reveal = useMemo(
    () =>
      buildRevealProps({
        revealId: run.key,
        pc: run.pc,
        guess: correct ? run.pc : run.timedOut ? null : toPitchClass(run.pc + 1),
        correct,
        streak: run.streak,
        multiplier: run.multiplier,
        stringIndex: STRING_INDEX,
        fret: FRET,
        // Même chemin qu'en jeu : la graine est tirée après le choix de l'effet.
        seed: revealSeed(run.key, LAB_SALT),
        geometry,
        reducedMotion: run.reducedMotion,
        label: run.label,
        onComplete: complete,
      }),
    [run, correct, geometry, complete],
  )

  // Le lab ne coupe pas l'effet : il signale seulement qu'il dépasserait la limite du jeu.
  useEffect(() => {
    const timer = window.setTimeout(() => onOverrun(run, capMs), capMs)
    return () => window.clearTimeout(timer)
  }, [capMs, onOverrun, run])

  return <RevealEffectHost effect={run.effect} reveal={reveal} />
}
