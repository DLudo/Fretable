import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listEffects } from '@/effects'
import type { RevealEffect, RevealOutcome } from '@/effects/types'
import { GAME_FEEL } from '@/game/config'
import { NOTES } from '@/game/music/notes'

/**
 * Lab d'effets — banc d'essai isolé pour concevoir et régler les révélations.
 * Accès : `/?lab`. Paramètres facultatifs pour l'automatisation :
 *   `effect=<id>` `outcome=correct|wrong` `streak=<n>` `label=<texte>` `autoplay=1` `delay=<ms>`
 */
const MARKER_SIZE = 26
const PX_PER_MM = 3.7

interface Run {
  key: number
  effect: RevealEffect
  outcome: RevealOutcome
}

const params = new URLSearchParams(window.location.search)

export default function EffectsLab() {
  const [streak, setStreak] = useState(() => Number(params.get('streak') ?? 1))
  const [label, setLabel] = useState(() => params.get('label') ?? 'Sol♯')
  const [runs, setRuns] = useState<Run[]>([])
  const counter = useRef(0)
  const effects = useMemo(() => listEffects(), [])

  const play = useCallback((effect: RevealEffect, outcome: RevealOutcome) => {
    const key = ++counter.current
    setRuns((list) => [...list, { key, effect, outcome }])
  }, [])

  useEffect(() => {
    if (params.get('autoplay') !== '1') return
    const id = params.get('effect')
    const outcome = (params.get('outcome') as RevealOutcome | null) ?? 'correct'
    const effect =
      effects.find((e) => e.id === id) ?? effects.find((e) => e.outcomes.includes(outcome))
    if (!effect) return
    const timer = window.setTimeout(() => play(effect, outcome), Number(params.get('delay') ?? 300))
    return () => window.clearTimeout(timer)
  }, [effects, play])

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

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Série
          <input
            type="range"
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
            {NOTES.map((n) => (
              <option key={n.pc}>{n.solfege}</option>
            ))}
          </select>
        </label>
      </div>

      <div
        data-slot="lab-stage"
        className="relative h-64 overflow-visible rounded-xl border bg-fretboard"
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-string" />
        <div
          className="absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-marker"
          style={{ width: MARKER_SIZE, height: MARKER_SIZE }}
        />
        {runs.map(({ key, effect, outcome }) => (
          <StageEffect
            key={key}
            id={key}
            effect={effect}
            outcome={outcome}
            label={label}
            streak={outcome === 'correct' ? streak : 0}
            onDone={() => setRuns((list) => list.filter((r) => r.key !== key))}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {effects.map((effect) => (
          <div key={effect.id} className="flex items-center gap-2 rounded-lg border p-3">
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
        ))}
      </div>
    </div>
  )
}

function StageEffect({
  id,
  effect,
  outcome,
  label,
  streak,
  onDone,
}: {
  id: number
  effect: RevealEffect
  outcome: RevealOutcome
  label: string
  streak: number
  onDone: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const parent = stage.current?.parentElement
    if (parent) setSize({ w: parent.clientWidth, h: parent.clientHeight })
  }, [])
  const done = useRef(false)
  const complete = useCallback(() => {
    if (done.current) return
    done.current = true
    onDone()
  }, [onDone])
  const { Component } = effect
  const success = outcome === 'correct'
  return (
    <div ref={stage} className="pointer-events-none absolute inset-0">
      {size && (
        <Component
          id={id}
          outcome={outcome}
          label={label}
          x={size.w / 2}
          y={size.h / 2}
          markerSize={MARKER_SIZE}
          pxPerMm={PX_PER_MM}
          stringAngle={0}
          intensity={success ? Math.min(1, streak / GAME_FEEL.maxStreakIntensity) : 0}
          streak={streak}
          seed={(id * 2654435761) >>> 0}
          color={success ? 'var(--feedback-success)' : 'var(--feedback-error)'}
          colorForeground={
            success ? 'var(--feedback-success-foreground)' : 'var(--feedback-error-foreground)'
          }
          onComplete={complete}
        />
      )}
    </div>
  )
}
