import { GAME_FEEL } from '@/game/config'
import type { GameState } from './types'

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
