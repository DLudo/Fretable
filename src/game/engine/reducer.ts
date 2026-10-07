import { getLevel } from '@/game/levels/levels'
import type { GameAction, GameState, GuessResult } from './types'

export function createInitialState(levelIndex = 0): GameState {
  return {
    levelIndex,
    level: getLevel(levelIndex),
    phase: 'ready',
    challenge: null,
    locked: true,
    correctCount: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
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
        startedAt: action.now,
      }

    case 'guess': {
      if (state.phase !== 'playing' || state.locked || !state.challenge) return state
      if (isExpired(state, action.now)) {
        return {
          ...state,
          phase: 'lost',
          locked: true,
          endedAt: state.startedAt! + state.level.durationMs,
        }
      }
      const correct = action.pc === state.challenge.pc
      const streak = correct ? state.streak + 1 : 0
      const correctCount = state.correctCount + (correct ? 1 : 0)
      const result: GuessResult = {
        id: state.challenge.id,
        challenge: state.challenge,
        guess: action.pc,
        correct,
        streak,
        at: action.now,
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
        lastResult: result,
        results: [...state.results, result],
      }
    }

    case 'next':
      if (state.phase !== 'playing' || !state.locked) return state
      return { ...state, challenge: action.challenge, locked: false }

    case 'timeUp':
      if (state.phase !== 'playing') return state
      return { ...state, phase: 'lost', locked: true, endedAt: action.now }
  }
}
