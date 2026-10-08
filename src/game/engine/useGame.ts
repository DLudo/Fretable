import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { ASSIST_RULES, GAME_FEEL } from '@/game/config'
import { hasNextLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { STANDARD_TUNING, type Tuning } from '@/game/music/tuning'
import { createAssistChallenge, createChallenge, type Random } from './challenge'
import {
  createGameEventBus,
  diffGameEvents,
  emitGameEvent,
  EMPTY_EVENT_SNAPSHOT,
  type GameEventBus,
  type GameEventSnapshot,
} from './events'
import { createInitialState, gameReducer } from './reducer'
import type { AssistState, Challenge, GameState } from './types'

export interface UseGameOptions {
  tuning?: Tuning
  random?: Random
  initialLevel?: number
}

export interface GameController {
  state: GameState
  tuning: Tuning
  /** Bus d'événements ; pour un même changement d'état : `guess` → `combo` → `assist` → `phase` → `challenge`. */
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
    (previous: Challenge | null, assist: AssistState | null = null) =>
      assist
        ? createAssistChallenge(
            ++nextId.current,
            state.level,
            tuning,
            random,
            assist.pc,
            previous,
            ASSIST_RULES.samePosition,
          )
        : createChallenge(++nextId.current, state.level, tuning, random, previous),
    [state.level, tuning, random],
  )

  const start = useCallback(() => {
    dispatch({ type: 'start', now: now(), challenge: makeChallenge(null) })
  }, [makeChallenge])

  const guess = useCallback(
    (pc: PitchClass) => dispatch({ type: 'guess', pc, now: now(), roll: random() }),
    [random],
  )

  const nextLevel = useCallback(() => {
    if (hasNextLevel(state.levelIndex)) dispatch({ type: 'load', levelIndex: state.levelIndex + 1 })
  }, [state.levelIndex])

  // Après une tentative : on laisse vivre la révélation, puis nouvelle note
  // (imposée par le coup de pouce s'il est en cours).
  const { phase, locked, lastResult, challenge, startedAt, assist } = state
  useEffect(() => {
    if (phase !== 'playing' || !locked || !lastResult) return
    const hold = lastResult.correct ? GAME_FEEL.holdAfterCorrectMs : GAME_FEEL.holdAfterWrongMs
    const timer = window.setTimeout(
      () =>
        dispatch({
          type: 'next',
          challenge: makeChallenge(lastResult.challenge, assist),
          now: now(),
        }),
      hold,
    )
    return () => window.clearTimeout(timer)
  }, [phase, locked, lastResult, assist, makeChallenge])

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

  // Épuisement du combo. Le minuteur peut sonner une poignée de ms trop tôt :
  // l'instant transmis ne précède jamais l'échéance, sans quoi le combo resterait allumé.
  const comboEndsAt = state.combo?.endsAt ?? null
  useEffect(() => {
    if (phase !== 'playing' || comboEndsAt === null) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'comboExpire', now: Math.max(now(), comboEndsAt) }),
      Math.max(0, comboEndsAt - now()),
    )
    return () => window.clearTimeout(timer)
  }, [phase, comboEndsAt])

  // Diffusion des événements, dans un ordre défini (voir `diffGameEvents`).
  // Le ref mémorise ce qui a déjà été publié : rien n'est émis deux fois,
  // même quand StrictMode rejoue les effets au montage.
  const emitted = useRef<GameEventSnapshot>(EMPTY_EVENT_SNAPSHOT)
  const { combo } = state
  useEffect(() => {
    const snapshot: GameEventSnapshot = { phase, challenge, lastResult, combo, assist }
    const pending = diffGameEvents(emitted.current, snapshot)
    emitted.current = snapshot
    for (const event of pending) emitGameEvent(events, event)
  }, [phase, challenge, lastResult, combo, assist, events])

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
