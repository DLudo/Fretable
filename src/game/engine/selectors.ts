import { GAME_FEEL } from '@/game/config'
import type { GameState } from './types'

/** Temps imparti à la partie (ms) : celui du niveau, plus le temps accordé en cours de route. */
export function totalDurationMs(state: Pick<GameState, 'level' | 'bonusTimeMs'>): number {
  return state.level.durationMs + state.bonusTimeMs
}

/**
 * Échéance (`performance.now()`) de la partie, ou `null` avant le départ et
 * pendant une pause (le temps ne court pas). Les pauses passées la repoussent
 * d'autant.
 */
export function deadlineAt(
  state: Pick<GameState, 'level' | 'bonusTimeMs' | 'startedAt' | 'pausedAt' | 'pausedMs'>,
): number | null {
  if (state.startedAt === null || state.pausedAt !== null) return null
  return state.startedAt + totalDurationMs(state) + state.pausedMs
}

/** Durée du décompte 3, 2, 1 avant la première note (ms). */
export function startCountdownMs(): number {
  return Math.max(0, GAME_FEEL.startCountdownFrom) * Math.max(0, GAME_FEEL.startCountdownStepMs)
}

/** Instant où le décompte s'achève et où la partie démarre, ou `null` hors décompte. */
export function playStartsAt(state: Pick<GameState, 'phase' | 'startingAt'>): number | null {
  if (state.phase !== 'starting' || state.startingAt === null) return null
  return state.startingAt + startCountdownMs()
}

/** Chiffre du décompte à afficher à l'instant `now` (3, 2, 1), ou `null` hors décompte. */
export function countdownDigit(
  state: Pick<GameState, 'phase' | 'startingAt'>,
  now: number,
): number | null {
  const end = playStartsAt(state)
  if (end === null || now >= end || GAME_FEEL.startCountdownStepMs <= 0) return null
  const elapsed = Math.max(0, now - state.startingAt!)
  return GAME_FEEL.startCountdownFrom - Math.floor(elapsed / GAME_FEEL.startCountdownStepMs)
}

/**
 * Instant (`performance.now()`) où l'écran de fin peut s'afficher, ou `null`
 * hors fin de partie. Il attend que la dernière révélation ait eu le temps de
 * vivre : `max(fin, dernière tentative + délai)`. Vaut `endedAt` quand rien
 * n'est à attendre (affichage immédiat).
 */
export function endScreenAt(
  state: Pick<GameState, 'phase' | 'endedAt' | 'lastResult'>,
): number | null {
  const { phase, endedAt, lastResult } = state
  if (endedAt === null || (phase !== 'won' && phase !== 'lost')) return null
  if (!lastResult) return endedAt
  const hold = phase === 'won' ? GAME_FEEL.victoryDelayMs : GAME_FEEL.defeatDelayMs
  return Math.max(endedAt, lastResult.at + hold)
}
