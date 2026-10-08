import { GAME_FEEL } from '@/game/config'
import type { GameState } from './types'

/** Temps imparti à la partie (ms) : celui du niveau, plus le temps accordé en cours de route. */
export function totalDurationMs(state: Pick<GameState, 'level' | 'bonusTimeMs'>): number {
  return state.level.durationMs + state.bonusTimeMs
}

/** Échéance (`performance.now()`) de la partie, ou `null` avant le départ. */
export function deadlineAt(
  state: Pick<GameState, 'level' | 'bonusTimeMs' | 'startedAt'>,
): number | null {
  return state.startedAt === null ? null : state.startedAt + totalDurationMs(state)
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
