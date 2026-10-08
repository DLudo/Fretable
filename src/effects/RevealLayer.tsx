import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { useReducedMotion } from 'motion/react'

import type { GuessResult } from '@/game/engine/types'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { ReducedMotionReveal, RevealMultiplierContext, StaticReveal } from './kit'
import { pickEffect } from './registry'
import {
  buildRevealProps,
  drawSeed,
  FALLBACK_REVEAL_MS,
  randomSalt,
  reducedMotionDurationMs,
  revealCapMs,
  revealGeometry,
  revealOutcome,
  revealStream,
  usesReducedMotionFallback,
} from './reveal-props'
import type { RevealEffect, RevealEffectProps, RevealOutcome } from './types'

/* — Hôte d'un effet : partagé par le calque et le lab — */

interface EffectBoundaryProps {
  effectId: string
  fallback: ReactNode
  onError?: (effectId: string, error: unknown) => void
  children: ReactNode
}

/** Isole un effet : s'il plante, la révélation de secours prend sa place et le jeu continue. */
class EffectBoundary extends Component<EffectBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(
      `[effects] L'effet « ${this.props.effectId} » a levé une erreur : révélation de secours affichée.`,
      error,
      info.componentStack,
    )
    this.props.onError?.(this.props.effectId, error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export interface RevealEffectHostProps {
  effect: RevealEffect
  reveal: RevealEffectProps
  /** Appelé si l'effet lève une erreur (après l'affichage du secours). */
  onError?: (effectId: string, error: unknown) => void
}

/**
 * Joue un effet avec ses garde-fous : mouvement réduit (`ReducedMotionReveal`
 * si l'effet ne le gère pas) et erreur (étiquette statique ~700 ms, puis `onComplete`).
 * La durée de vie maximale reste à la charge de l'appelant (`revealCapMs`).
 */
export function RevealEffectHost({ effect, reveal, onError }: RevealEffectHostProps) {
  if (usesReducedMotionFallback(effect, reveal)) {
    return (
      <ReducedMotionReveal
        {...reveal}
        effectId={effect.id}
        durationMs={reducedMotionDurationMs(reveal.budgetMs)}
      />
    )
  }
  const { Component: Effect } = effect
  return (
    <EffectBoundary
      effectId={effect.id}
      onError={onError}
      fallback={<StaticReveal {...reveal} effectId={effect.id} durationMs={FALLBACK_REVEAL_MS} />}
    >
      <RevealMultiplierContext value={reveal.multiplier}>
        <Effect {...reveal} />
      </RevealMultiplierContext>
    </EffectBoundary>
  )
}

/** Effet de secours quand le registre n'a rien pour l'issue : la note est quand même révélée. */
function FallbackEffect(props: RevealEffectProps) {
  return <StaticReveal {...props} effectId="fallback" durationMs={FALLBACK_REVEAL_MS} />
}

const FALLBACK_EFFECT: RevealEffect = {
  id: 'fallback',
  name: 'Secours',
  outcomes: ['correct', 'wrong'],
  handlesReducedMotion: true,
  Component: FallbackEffect,
}

/* — Calque — */

interface ActiveReveal {
  result: GuessResult
  effect: RevealEffect
  seed: number
  /** Préférence relevée au déclenchement : une révélation garde son mode jusqu'au bout. */
  reducedMotion: boolean
}

/** Derniers effets joués : au total et par issue (« jamais deux fois de suite »). */
type RevealHistory = { last: string | null } & Record<RevealOutcome, string | null>

export interface RevealLayerProps {
  /** Dernière tentative : chaque nouvel `id` déclenche un effet ; `null` (nouvelle partie) les efface. */
  result: GuessResult | null
  layout: NeckLayout
  projection: BoardProjection
  /**
   * Sel des graines. Par défaut tiré au hasard au montage : chaque session joue
   * une suite d'effets différente. Une valeur fixe la rend reproductible (tests, captures).
   */
  seedSalt?: number
}

/**
 * Calque des révélations : choisit un effet dans le registre pour chaque
 * tentative et le joue à l'emplacement exact du repère.
 * Plusieurs effets peuvent se chevaucher (enchaînements rapides).
 */
export function RevealLayer({ result, layout, projection, seedSalt }: RevealLayerProps) {
  const reducedMotion = useReducedMotion() ?? false
  const [sessionSalt] = useState(randomSalt)
  const salt = seedSalt ?? sessionSalt
  const [active, setActive] = useState<ActiveReveal[]>([])
  const history = useRef<RevealHistory>({ last: null, correct: null, wrong: null })
  const failed = useRef(new Set<string>())
  const seen = useRef<number | null>(null)

  // Nouvelle partie : les révélations de la précédente ne doivent pas déborder dessus.
  if (result === null && active.length > 0) setActive([])

  useEffect(() => {
    if (!result || seen.current === result.id) return
    seen.current = result.id
    const outcome = revealOutcome(result.correct)
    const random = revealStream(result.id, salt)
    const recent = history.current
    // Priorité décroissante : effets en échec, dernier joué, dernier de cette issue.
    const picked = pickEffect(outcome, random, [...failed.current, recent.last, recent[outcome]])
    if (picked) {
      recent.last = picked.id
      recent[outcome] = picked.id
    } else if (import.meta.env.DEV) {
      console.warn(
        `[effects] Aucun effet enregistré pour l'issue « ${outcome} » : révélation de secours. Importez RevealLayer depuis '@/effects' pour enregistrer les presets.`,
      )
    }
    const entry = {
      result,
      effect: picked ?? FALLBACK_EFFECT,
      seed: drawSeed(random),
      reducedMotion,
    }
    setActive((list) => [...list, entry])
  }, [result, salt, reducedMotion])

  const remove = useCallback((id: number) => {
    setActive((list) => list.filter((a) => a.result.id !== id))
  }, [])

  const markFailed = useCallback((effectId: string) => {
    failed.current.add(effectId)
  }, [])

  return (
    <div data-slot="reveal-layer" className="pointer-events-none absolute inset-0 overflow-visible">
      {active.map((reveal) => (
        <ActiveEffect
          key={reveal.result.id}
          reveal={reveal}
          layout={layout}
          projection={projection}
          onDone={remove}
          onError={markFailed}
        />
      ))}
    </div>
  )
}

function ActiveEffect({
  reveal,
  layout,
  projection,
  onDone,
  onError,
}: {
  reveal: ActiveReveal
  layout: NeckLayout
  projection: BoardProjection
  onDone: (id: number) => void
  onError: (effectId: string) => void
}) {
  const { result, effect, seed, reducedMotion } = reveal
  const { id, challenge } = result
  const complete = useCallback(() => onDone(id), [onDone, id])

  const props = useMemo(
    () =>
      buildRevealProps({
        revealId: id,
        pc: challenge.pc,
        guess: result.guess,
        correct: result.correct,
        streak: result.streak,
        reactionMs: result.reactionMs,
        points: result.points,
        multiplier: result.multiplier,
        stringIndex: challenge.stringIndex,
        fret: challenge.fret,
        seed,
        geometry: revealGeometry(layout, projection, challenge.stringIndex, challenge.fret),
        reducedMotion,
        onComplete: complete,
      }),
    [id, challenge, result, seed, layout, projection, reducedMotion, complete],
  )

  const capMs = revealCapMs(effect, props)
  useEffect(() => {
    const timer = window.setTimeout(complete, capMs)
    return () => window.clearTimeout(timer)
  }, [complete, capMs])

  return <RevealEffectHost effect={effect} reveal={props} onError={onError} />
}
