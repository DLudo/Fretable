import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { GAME_FEEL } from '@/game/config'
import { hasNextLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { STANDARD_TUNING, type Tuning } from '@/game/music/tuning'
import { createChallenge, type Random } from './challenge'
import {
  createGameEventBus,
  diffGameEvents,
  emitGameEvent,
  EMPTY_EVENT_SNAPSHOT,
  type GameEventBus,
  type GameEventSnapshot,
} from './events'
import { createInitialState, gameReducer } from './reducer'
import type { Challenge, GameState } from './types'

export interface UseGameOptions {
  tuning?: Tuning
  random?: Random
  initialLevel?: number
}

export interface GameController {
  state: GameState
  tuning: Tuning
  /** Bus d'événements ; pour un même changement d'état : `guess` → `phase` → `challenge`. */
  events: GameEventBus
  /** Démarre (ou redémarre) le niveau courant. */
  start(): void
  /** Propose une réponse ; ignorée hors partie ou pendant une révélation. */
  guess(pc: PitchClass): void
  /** Passe au niveau suivant s'il existe. */
  nextLevel(): void
  hasNextLevel: boolean
}

const now = () => performance.now()

export function useGame(options: UseGameOptions = {}): GameController {
  const tuning = options.tuning ?? STANDARD_TUNING
  const random = options.random ?? Math.random
  const [state, dispatch] = useReducer(gameReducer, options.initialLevel ?? 0, createInitialState)
  const events = useMemo(() => createGameEventBus(), [])

  // Identifiants uniques sur toute la session : deux révélations ne partagent jamais une clé.
  const nextId = useRef(0)
  const makeChallenge = useCallback(
    (previous: Challenge | null) =>
      createChallenge(++nextId.current, state.level, tuning, random, previous),
    [state.level, tuning, random],
  )

  const start = useCallback(() => {
    dispatch({ type: 'start', now: now(), challenge: makeChallenge(null) })
  }, [makeChallenge])

  const guess = useCallback((pc: PitchClass) => dispatch({ type: 'guess', pc, now: now() }), [])

  const nextLevel = useCallback(() => {
    if (hasNextLevel(state.levelIndex)) dispatch({ type: 'load', levelIndex: state.levelIndex + 1 })
  }, [state.levelIndex])

  // Après une tentative : on laisse vivre la révélation, puis nouvelle note.
  const { phase, locked, lastResult, challenge, startedAt } = state
  useEffect(() => {
    if (phase !== 'playing' || !locked || !lastResult) return
    const hold = lastResult.correct ? GAME_FEEL.holdAfterCorrectMs : GAME_FEEL.holdAfterWrongMs
    const timer = window.setTimeout(
      () => dispatch({ type: 'next', challenge: makeChallenge(lastResult.challenge) }),
      hold,
    )
    return () => window.clearTimeout(timer)
  }, [phase, locked, lastResult, makeChallenge])

  // Expiration du temps imparti.
  const durationMs = state.level.durationMs
  useEffect(() => {
    if (phase !== 'playing' || startedAt === null) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'timeUp', now: startedAt + durationMs }),
      Math.max(0, startedAt + durationMs - now()),
    )
    return () => window.clearTimeout(timer)
  }, [phase, startedAt, durationMs])

  // Diffusion des événements, dans un ordre défini (voir `diffGameEvents`).
  // Le ref mémorise ce qui a déjà été publié : rien n'est émis deux fois,
  // même quand StrictMode rejoue les effets au montage.
  const emitted = useRef<GameEventSnapshot>(EMPTY_EVENT_SNAPSHOT)
  useEffect(() => {
    const snapshot: GameEventSnapshot = { phase, challenge, lastResult }
    const pending = diffGameEvents(emitted.current, snapshot)
    emitted.current = snapshot
    for (const event of pending) emitGameEvent(events, event)
  }, [phase, challenge, lastResult, events])

  return {
    state,
    tuning,
    events,
    start,
    guess,
    nextLevel,
    hasNextLevel: hasNextLevel(state.levelIndex),
  }
}
