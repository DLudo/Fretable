import type { RatingRules } from '@/game/config'

/**
 * Level design : chaque niveau est une donnée pure.
 * Ajouter un niveau = ajouter une entrée à `LEVELS`.
 */
export interface LevelConfig {
  id: string
  /** Numéro affiché (1, 2, 3…). */
  number: number
  title: string
  /** Nombre de notes à trouver pour valider le niveau. */
  targetCount: number
  /** Temps imparti, en millisecondes. */
  durationMs: number
  /** Cases jouables (incluses). */
  frets: { min: number; max: number }
  /** Index des cordes jouables (0 = Mi grave). */
  strings: readonly number[]
  /** Réglages de notation propres au niveau (sinon `RATING_RULES`). */
  rating?: Partial<RatingRules>
}

export const LEVELS: readonly LevelConfig[] = [
  {
    id: 'level-1',
    number: 1,
    title: 'Niveau 1',
    targetCount: 6,
    durationMs: 30_000,
    frets: { min: 1, max: 12 },
    strings: [0, 1, 2, 3, 4, 5],
  },
]

export function getLevel(index: number): LevelConfig {
  const level = LEVELS[index]
  if (!level) throw new RangeError(`Niveau inexistant : ${index}`)
  return level
}

export function hasNextLevel(index: number): boolean {
  return index + 1 < LEVELS.length
}
