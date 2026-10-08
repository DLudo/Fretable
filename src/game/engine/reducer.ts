import { getLevel } from '@/game/levels/levels'
import { basePoints, stepCombo } from './scoring'
import type { GameAction, GameState, GuessResult } from './types'

export function createInitialState(levelIndex = 0): GameState {
  return {
    levelIndex,
    level: getLevel(levelIndex),
    phase: 'ready',
    challenge: null,
    challengeShownAt: null,
    locked: true,
    correctCount: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
    fastStreak: 0,
    combo: null,
    startedAt: null,
    endedAt: null,
    lastResult: null,
    results: [],
  }
}

function isExpired(state: GameState, now: number): boolean {
  return state.startedAt !== null && now - state.startedAt >= state.level.durationMs
}

/**
 * Machine à états du jeu — pure et déterministe.
 * Le hasard et l'horloge sont injectés par les actions (voir `useGame`).
 *
 *   ready ──start──▶ playing ──(dernière bonne réponse)──▶ won
 *                       │
 *                       └──────────(timeUp)──────────────▶ lost
 *
 * `load` ramène à `ready` sur un autre niveau ; `start` relance depuis n'importe quelle phase.
 * Le combo (voir `stepCombo`) vit à côté : déclenché par les réponses, épuisé par `comboExpire`.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return createInitialState(action.levelIndex)

    case 'start':
      return {
        ...createInitialState(state.levelIndex),
        phase: 'playing',
        locked: false,
        challenge: action.challenge,
        challengeShownAt: action.now,
        startedAt: action.now,
      }

    case 'guess': {
      if (state.phase !== 'playing' || state.locked || !state.challenge) return state
      // Réponse arrivée après l'échéance : refusée, comme si le minuteur avait sonné à temps.
      if (isExpired(state, action.now)) {
        return timeUp(state, state.startedAt! + state.level.durationMs)
      }
      const correct = action.pc === state.challenge.pc
      const streak = correct ? state.streak + 1 : 0
      const correctCount = state.correctCount + (correct ? 1 : 0)
      const reactionMs = Math.max(0, action.now - (state.challengeShownAt ?? action.now))
      const step = stepCombo(state.combo, state.fastStreak, {
        now: action.now,
        correct,
        reactionMs,
      })
      const base = correct ? basePoints(reactionMs) : 0
      const result: GuessResult = {
        id: state.challenge.id,
        challenge: state.challenge,
        guess: action.pc,
        correct,
        streak,
        at: action.now,
        reactionMs,
        basePoints: base,
        multiplier: step.multiplier,
        points: base * step.multiplier,
        comboTriggered: step.triggered,
      }
      const won = correctCount >= state.level.targetCount
      return {
        ...state,
        phase: won ? 'won' : 'playing',
        endedAt: won ? action.now : null,
        locked: true,
        correctCount,
        mistakes: state.mistakes + (correct ? 0 : 1),
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        score: state.score + result.points,
        // La partie gagnée, le combo s'éteint avec elle.
        combo: won ? null : step.combo,
        fastStreak: step.fastStreak,
        lastResult: result,
        results: [...state.results, result],
      }
    }

    case 'next':
      if (state.phase !== 'playing' || !state.locked) return state
      return {
        ...state,
        challenge: action.challenge,
        challengeShownAt: action.now,
        locked: false,
      }

    case 'timeUp':
      if (state.phase !== 'playing') return state
      return timeUp(state, action.now)

    case 'comboExpire':
      // Jauge vide : le combo s'éteint, il faudra à nouveau trois réponses rapides.
      if (!state.combo || action.now < state.combo.endsAt) return state
      return { ...state, combo: null, fastStreak: 0 }
  }
}

/**
 * Fin du temps imparti. Une note encore en attente de réponse est révélée
 * (tentative `guess: null`, non comptée comme erreur) ; si une révélation est
 * déjà en cours (`locked`), elle suffit.
 */
function timeUp(state: GameState, now: number): GameState {
  const ended: GameState = { ...state, phase: 'lost', locked: true, endedAt: now, combo: null }
  if (state.locked || !state.challenge) return ended
  const result: GuessResult = {
    id: state.challenge.id,
    challenge: state.challenge,
    guess: null,
    correct: false,
    streak: 0,
    at: now,
    reactionMs: null,
    basePoints: 0,
    multiplier: 1,
    points: 0,
    comboTriggered: false,
  }
  return { ...ended, streak: 0, lastResult: result, results: [...state.results, result] }
}
