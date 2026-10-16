import { createInitialState } from '@/game/engine/reducer'
import type { GameState } from '@/game/engine/types'
import { getLevel, type LevelConfig } from '@/game/levels/levels'

/**
 * Niveau d'essai, figé : 6 notes en 30 s. Les tests du moteur en dépendent ;
 * ils ne bougent donc pas quand on règle le niveau 1 du jeu.
 */
export const TEST_LEVEL: LevelConfig = { ...getLevel(0), targetCount: 6, durationMs: 30_000 }

/** État initial sur le niveau d'essai (conservé par `prepare` et `start`). */
export function testState(): GameState {
  return { ...createInitialState(0), level: TEST_LEVEL }
}
