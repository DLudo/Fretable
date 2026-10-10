import { BOSS_RULES } from '@/game/config'
import { createChallenge, type Random } from '@/game/engine/challenge'
import type { Challenge } from '@/game/engine/types'
import type { LevelConfig } from '@/game/levels/levels'
import type { Tuning } from '@/game/music/tuning'
import type { BossNote } from './types'

/**
 * Partition du boss : `BOSS_RULES.noteCount` positions tirées au hasard dans le
 * périmètre du niveau (jamais deux fois la même note d'affilée), parties à
 * intervalle régulier : la première `startDelayMs` après `startAt`, puis une
 * toutes les `intervalMs`, chacune `travelMs` avant d'atteindre sa cible. Le
 * calendrier ne bouge plus ensuite, quels que soient les jugements.
 */
export function createBossChart(
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  startAt: number,
  rules: Pick<
    typeof BOSS_RULES,
    'noteCount' | 'travelMs' | 'intervalMs' | 'startDelayMs'
  > = BOSS_RULES,
): BossNote[] {
  const notes: BossNote[] = []
  let previous: Challenge | null = null
  for (let i = 0; i < rules.noteCount; i++) {
    const { id, stringIndex, fret, pc } = createChallenge(i + 1, level, tuning, random, previous)
    previous = { id, stringIndex, fret, pc }
    const launchAt = startAt + rules.startDelayMs + i * rules.intervalMs
    notes.push({ id, stringIndex, fret, pc, launchAt, hitAt: launchAt + rules.travelMs })
  }
  return notes
}
