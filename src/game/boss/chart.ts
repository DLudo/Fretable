import { BOSS_RULES } from '@/game/config'
import { createChallenge, type Random } from '@/game/engine/challenge'
import type { Challenge } from '@/game/engine/types'
import type { LevelConfig } from '@/game/levels/levels'
import type { Tuning } from '@/game/music/tuning'
import type { BossNote } from './types'

type ChartRules = Pick<
  typeof BOSS_RULES,
  'bossLife' | 'life' | 'travelMs' | 'intervalMs' | 'startDelayMs'
> & {
  /** Notes bonus : chance par intervalle et trajet (voir `BOSS_RULES.bonus`). */
  bonus: { chance: number; travelMs: number }
}

/**
 * Nombre de notes de la partition : de quoi finir le combat, quoi qu'il arrive.
 * Le boss tombe après `bossLife` réussites, et chaque échec ne fait qu'allonger
 * le combat ; mais le joueur n'encaisse qu'un nombre fini d'échecs : chacun lui
 * coûte au moins `min(miss, wrong)`, et sa vie de départ plus tout ce que les
 * réussites peuvent lui rendre n'en couvre pas davantage (62 notes du boss au
 * plus avec les réglages actuels, notes bonus non comprises). Sans coût
 * d'échec, le combat est borné au triple.
 */
export function bossChartLength(rules: Pick<ChartRules, 'bossLife' | 'life'> = BOSS_RULES): number {
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
 * toutes les `intervalMs`, chacune `travelMs` avant d'atteindre sa cible. Entre
 * deux d'entre elles, une note bonus peut s'intercaler (`bonus.chance`) : elle
 * atteint sa cible à mi-chemin, après un trajet plus court (`bonus.travelMs`).
 * Les notes sont rangées dans leur ordre d'arrivée. Le calendrier ne bouge plus
 * ensuite, quels que soient les jugements ; le combat s'arrête dès que le boss
 * ou le joueur tombe, notes encore en vol comprises.
 */
export function createBossChart(
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  startAt: number,
  rules: ChartRules = BOSS_RULES,
): BossNote[] {
  const notes: BossNote[] = []
  // Note qui précède dans l'ordre d'arrivée (bonus compris), et dernière note du boss.
  let previous: Challenge | null = null
  let previousRegular: Challenge | null = null
  const draw = (): Challenge => {
    previous = createChallenge(notes.length + 1, level, tuning, random, previous)
    return previous
  }
  const count = bossChartLength(rules)
  for (let i = 0; i < count; i++) {
    // Une note du boss diffère aussi de la précédente note du boss, bonus intercalé
    // ou non : deux notes du boss de suite ne tombent jamais au même endroit.
    let regular = draw()
    for (let attempt = 0; attempt < 32 && regular.pc === previousRegular?.pc; attempt++) {
      previous = notes.at(-1) ?? null
      regular = draw()
    }
    previousRegular = regular
    const { id, stringIndex, fret, pc } = regular
    const launchAt = startAt + rules.startDelayMs + i * rules.intervalMs
    const hitAt = launchAt + rules.travelMs
    notes.push({ id, stringIndex, fret, pc, launchAt, hitAt })
    // Note bonus, à mi-chemin de la suivante : jamais après la dernière.
    if (i < count - 1 && random() < rules.bonus.chance) {
      const extra = draw()
      const bonusHitAt = hitAt + rules.intervalMs / 2
      notes.push({
        id: extra.id,
        stringIndex: extra.stringIndex,
        fret: extra.fret,
        pc: extra.pc,
        launchAt: bonusHitAt - rules.bonus.travelMs,
        hitAt: bonusHitAt,
        bonus: true,
      })
    }
  }
  return notes
}
