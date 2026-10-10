import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { ASSIST_RULES, GAME_FEEL, TRIAD_RULES } from '@/game/config'
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
import { deadlineAt, playStartsAt, startCountdownMs } from './selectors'
import {
  canStartTriad,
  createTriadVoicing,
  planTriad,
  scaleChallenge,
  triadChallenge,
} from './triad'
import type { AssistState, Challenge, GameState, TriadPlan } from './types'

export interface UseGameOptions {
  tuning?: Tuning
  random?: Random
  initialLevel?: number
}

export interface GameController {
  state: GameState
  tuning: Tuning
  /**
   * Bus d'événements ; pour un même changement d'état :
   * `guess` → `combo` → `assist` → `triad` → `triadResult` → `scaleRun` → `scaleResult`
   * → `phase` → `challenge`.
   * Une partie s'ouvre sur `phase: starting` (décompte 3, 2, 1), puis `phase: playing` et la première note.
   */
  events: GameEventBus
  /** Démarre (ou redémarre) le niveau courant, après le décompte 3, 2, 1. */
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
    if (startCountdownMs() > 0) dispatch({ type: 'prepare', now: now() })
    else dispatch({ type: 'start', now: now(), challenge: makeChallenge(null) })
  }, [makeChallenge])

  const guess = useCallback(
    (pc: PitchClass) => dispatch({ type: 'guess', pc, now: now(), roll: random() }),
    [random],
  )

  const nextLevel = useCallback(() => {
    if (hasNextLevel(state.levelIndex)) dispatch({ type: 'load', levelIndex: state.levelIndex + 1 })
  }, [state.levelIndex])

  // Fin du décompte : la partie démarre sur la première note, et le temps se met à courir.
  const playAt = playStartsAt(state)
  useEffect(() => {
    if (playAt === null) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'start', now: now(), challenge: makeChallenge(null) }),
      Math.max(0, playAt - now()),
    )
    return () => window.clearTimeout(timer)
  }, [playAt, makeChallenge])

  // Après une tentative : on laisse vivre la révélation, puis nouvelle note —
  // imposée par la triade ou le coup de pouce en cours, ou début d'une triade.
  const { phase, locked, lastResult, challenge, assist, triad, triadsStarted, correctCount } = state
  const { level, scaleRun, triadCooldown, triadIntro } = state
  useEffect(() => {
    if (phase !== 'playing' || !locked || !lastResult) return
    if (triadIntro) {
      // Annonce en cours : la triade s'ouvre sur sa fondamentale à son terme.
      const { at, ...plan } = triadIntro
      const timer = window.setTimeout(
        () =>
          dispatch({
            type: 'next',
            challenge: triadChallenge(++nextId.current, plan, 0),
            now: now(),
            triad: plan,
          }),
        Math.max(0, at + TRIAD_RULES.introMs - now()),
      )
      return () => window.clearTimeout(timer)
    }
    const hold = lastResult.correct ? GAME_FEEL.holdAfterCorrectMs : GAME_FEEL.holdAfterWrongMs
    const timer = window.setTimeout(() => {
      let next: Challenge
      let opening: TriadPlan | undefined
      if (scaleRun) {
        next = scaleChallenge(++nextId.current, scaleRun, scaleRun.step)
      } else if (triad) {
        next = triadChallenge(++nextId.current, triad, triad.step)
      } else {
        const eligible = canStartTriad({
          phase,
          triad,
          assist,
          triadsStarted,
          triadCooldown,
          correctCount,
          level,
          scaleRun,
        })
        const voicing =
          eligible && random() < TRIAD_RULES.chance
            ? createTriadVoicing(level, tuning, random, lastResult.challenge)
            : null
        if (voicing && TRIAD_RULES.introMs > 0) {
          // La triade s'annonce d'abord ; l'annonce terminée, elle s'ouvrira.
          dispatch({ type: 'announceTriad', now: now(), triad: planTriad(voicing, level, tuning) })
          return
        }
        if (voicing) {
          next = triadChallenge(++nextId.current, voicing, 0)
          opening = planTriad(voicing, level, tuning)
        } else {
          next = makeChallenge(lastResult.challenge, assist)
        }
      }
      dispatch({
        type: 'next',
        challenge: next,
        now: now(),
        ...(opening ? { triad: opening } : {}),
      })
    }, hold)
    return () => window.clearTimeout(timer)
  }, [
    phase,
    locked,
    lastResult,
    assist,
    triad,
    scaleRun,
    triadIntro,
    triadsStarted,
    triadCooldown,
    correctCount,
    level,
    tuning,
    random,
    makeChallenge,
  ])

  // Expiration du temps imparti (reprogrammée quand du temps est accordé).
  const deadline = deadlineAt(state)
  useEffect(() => {
    if (phase !== 'playing' || deadline === null) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'timeUp', now: deadline }),
      Math.max(0, deadline - now()),
    )
    return () => window.clearTimeout(timer)
  }, [phase, deadline])

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
  const { combo, lastTriad, lastScaleRun } = state
  useEffect(() => {
    const snapshot: GameEventSnapshot = {
      phase,
      challenge,
      lastResult,
      combo,
      assist,
      triadIntro,
      triad,
      lastTriad,
      scaleRun,
      lastScaleRun,
    }
    const pending = diffGameEvents(emitted.current, snapshot)
    emitted.current = snapshot
    for (const event of pending) emitGameEvent(events, event)
  }, [
    phase,
    challenge,
    lastResult,
    combo,
    assist,
    triadIntro,
    triad,
    lastTriad,
    scaleRun,
    lastScaleRun,
    events,
  ])

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
