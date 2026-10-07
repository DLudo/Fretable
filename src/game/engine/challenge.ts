import type { LevelConfig } from '@/game/levels/levels'
import { pitchClassAt, type Tuning } from '@/game/music/tuning'
import type { Challenge } from './types'

export type Random = () => number

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length) % items.length]
}

/**
 * Tire une nouvelle note au hasard dans le périmètre du niveau.
 * Évite de reproposer la même note (classe de hauteur) que la précédente,
 * ce qui rendrait la manche triviale.
 */
export function createChallenge(
  id: number,
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  previous?: Challenge | null,
): Challenge {
  const frets = Array.from(
    { length: level.frets.max - level.frets.min + 1 },
    (_, i) => level.frets.min + i,
  )
  let candidate: Challenge | null = null
  for (let attempt = 0; attempt < 32; attempt++) {
    const stringIndex = pick(level.strings, random)
    const fret = pick(frets, random)
    candidate = { id, stringIndex, fret, pc: pitchClassAt(tuning, stringIndex, fret) }
    if (!previous || candidate.pc !== previous.pc) return candidate
  }
  return candidate!
}
