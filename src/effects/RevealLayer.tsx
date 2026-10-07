import { useCallback, useEffect, useRef, useState } from 'react'

import { GAME_FEEL, NOTATION } from '@/game/config'
import type { GuessResult } from '@/game/engine/types'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { noteName } from '@/game/music/notes'
import { seededRandom } from './random'
import { pickEffect } from './registry'
import type { RevealEffect, RevealOutcome } from './types'

/** Filet de sécurité : un effet qui oublie `onComplete` est démonté au bout de ce délai. */
const MAX_EFFECT_LIFETIME_MS = 3000

const COLORS: Record<RevealOutcome, { color: string; foreground: string }> = {
  correct: { color: 'var(--feedback-success)', foreground: 'var(--feedback-success-foreground)' },
  wrong: { color: 'var(--feedback-error)', foreground: 'var(--feedback-error-foreground)' },
}

interface ActiveReveal {
  result: GuessResult
  effect: RevealEffect
  seed: number
}

export interface RevealLayerProps {
  /** Dernière tentative : chaque nouvel `id` déclenche un effet. */
  result: GuessResult | null
  layout: NeckLayout
  projection: BoardProjection
}

/**
 * Calque des révélations : choisit un effet dans le registre pour chaque
 * tentative et le joue à l'emplacement exact du repère.
 * Plusieurs effets peuvent se chevaucher (enchaînements rapides).
 */
export function RevealLayer({ result, layout, projection }: RevealLayerProps) {
  const [active, setActive] = useState<ActiveReveal[]>([])
  const previousEffect = useRef<Record<RevealOutcome, string | null>>({ correct: null, wrong: null })
  const seen = useRef<number | null>(null)

  useEffect(() => {
    if (!result || seen.current === result.id) return
    seen.current = result.id
    const outcome: RevealOutcome = result.correct ? 'correct' : 'wrong'
    const seed = (result.id * 2654435761) >>> 0
    const effect = pickEffect(outcome, seededRandom(seed), previousEffect.current[outcome])
    if (!effect) return
    previousEffect.current[outcome] = effect.id
    setActive((list) => [...list, { result, effect, seed }])
  }, [result])

  const remove = useCallback((id: number) => {
    setActive((list) => list.filter((a) => a.result.id !== id))
  }, [])

  return (
    <div data-slot="reveal-layer" className="pointer-events-none absolute inset-0 overflow-visible">
      {active.map(({ result, effect, seed }) => (
        <ActiveEffect
          key={result.id}
          result={result}
          effect={effect}
          seed={seed}
          layout={layout}
          projection={projection}
          onDone={remove}
        />
      ))}
    </div>
  )
}

function ActiveEffect({
  result,
  effect,
  seed,
  layout,
  projection,
  onDone,
}: ActiveReveal & {
  layout: NeckLayout
  projection: BoardProjection
  onDone: (id: number) => void
}) {
  const { id, challenge, correct, streak } = result
  const outcome: RevealOutcome = correct ? 'correct' : 'wrong'
  const complete = useCallback(() => onDone(id), [onDone, id])

  useEffect(() => {
    const timer = window.setTimeout(complete, MAX_EFFECT_LIFETIME_MS)
    return () => window.clearTimeout(timer)
  }, [complete])

  const { x, y } = projection.toPx(layout.position(challenge.stringIndex, challenge.fret))
  const string = layout.strings[challenge.stringIndex]
  const stringAngle = Math.atan2(string.to.y - string.from.y, string.to.x - string.from.x)
  const { Component } = effect

  return (
    <Component
      id={id}
      outcome={outcome}
      label={noteName(challenge.pc, NOTATION)}
      x={x}
      y={y}
      markerSize={layout.markerRadius * 2 * projection.pxPerMm}
      pxPerMm={projection.pxPerMm}
      stringAngle={stringAngle}
      intensity={correct ? Math.min(1, streak / GAME_FEEL.maxStreakIntensity) : 0}
      streak={streak}
      seed={seed}
      color={COLORS[outcome].color}
      colorForeground={COLORS[outcome].foreground}
      onComplete={complete}
    />
  )
}
