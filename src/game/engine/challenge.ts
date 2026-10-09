import type { LevelConfig } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
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

/**
 * Note imposée par le coup de pouce : même classe de hauteur que `pc`, à un
 * autre endroit du manche que la note précédente quand c'est possible (ou au
 * même endroit si `samePosition`).
 */
export function createAssistChallenge(
  id: number,
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  pc: PitchClass,
  previous: Challenge | null,
  samePosition = false,
): Challenge {
  if (samePosition && previous && previous.pc === pc) {
    return { id, stringIndex: previous.stringIndex, fret: previous.fret, pc, assist: true }
  }
  const positions: Array<{ stringIndex: number; fret: number }> = []
  for (const stringIndex of level.strings) {
    for (let fret = level.frets.min; fret <= level.frets.max; fret++) {
      if (pitchClassAt(tuning, stringIndex, fret) !== pc) continue
      if (previous && previous.stringIndex === stringIndex && previous.fret === fret) continue
      positions.push({ stringIndex, fret })
    }
  }
  const spot =
    positions.length > 0
      ? pick(positions, random)
      : (previous ?? { stringIndex: level.strings[0], fret: level.frets.min })
  return { id, stringIndex: spot.stringIndex, fret: spot.fret, pc, assist: true }
}
