import { BOSS_RULES } from '@/game/config'
import { createChallenge, type Random } from '@/game/engine/challenge'
import type { Challenge } from '@/game/engine/types'
import type { LevelConfig } from '@/game/levels/levels'
import type { Tuning } from '@/game/music/tuning'
import type { BossNote } from './types'

type ChartRules = Pick<
  typeof BOSS_RULES,
  'bossLife' | 'life' | 'travelMs' | 'intervalMs' | 'startDelayMs'
>

/**
 * Nombre de notes de la partition : de quoi finir le combat, quoi qu'il arrive.
 * Le boss tombe après `bossLife` réussites, et chaque échec ne fait qu'allonger
 * le combat ; mais le joueur n'encaisse qu'un nombre fini d'échecs : chacun lui
 * coûte au moins `min(miss, wrong)`, et sa vie de départ plus tout ce que les
 * réussites peuvent lui rendre n'en couvre pas davantage (62 notes au plus avec
 * les réglages actuels). Sans coût d'échec, le combat est borné au triple.
 */
export function bossChartLength(
  rules: Omit<ChartRules, 'travelMs' | 'intervalMs' | 'startDelayMs'> = BOSS_RULES,
): number {
  const { start, miss, wrong, heal } = rules.life
  const cost = Math.min(miss, wrong)
  const maxHeal = Math.max(heal.perfect, heal.great, heal.good)
  const failures =
    cost > 0 ? Math.ceil((start + rules.bossLife * maxHeal) / cost) : rules.bossLife * 2
  return rules.bossLife + failures
}

/**
 * Partition du boss : `bossChartLength` positions tirées au hasard dans le
 * périmètre du niveau (jamais deux fois la même note d'affilée), parties à
 * intervalle régulier : la première `startDelayMs` après `startAt`, puis une
 * toutes les `intervalMs`, chacune `travelMs` avant d'atteindre sa cible. Le
 * calendrier ne bouge plus ensuite, quels que soient les jugements ; le combat
 * s'arrête dès que le boss ou le joueur tombe, notes encore en vol comprises.
 */
export function createBossChart(
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  startAt: number,
  rules: ChartRules = BOSS_RULES,
): BossNote[] {
  const notes: BossNote[] = []
  let previous: Challenge | null = null
  for (let i = 0, count = bossChartLength(rules); i < count; i++) {
    const { id, stringIndex, fret, pc } = createChallenge(i + 1, level, tuning, random, previous)
    previous = { id, stringIndex, fret, pc }
    const launchAt = startAt + rules.startDelayMs + i * rules.intervalMs
    notes.push({ id, stringIndex, fret, pc, launchAt, hitAt: launchAt + rules.travelMs })
  }
  return notes
}
