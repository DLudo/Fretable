import { BOSS_RULES } from '@/game/config'
import { createChallenge, pick, type Random } from '@/game/engine/challenge'
import type { Challenge } from '@/game/engine/types'
import type { LevelConfig } from '@/game/levels/levels'
import { pitchClassAt, type Tuning } from '@/game/music/tuning'
import { windowOf, type WindowRules } from './reducer'
import type { BossNote } from './types'

type ChartRules = Pick<
  typeof BOSS_RULES,
  'bossLife' | 'life' | 'travelMs' | 'intervalMs' | 'startDelayMs' | 'fadeMs'
> &
  WindowRules & {
    /** Notes bonus : chance par intervalle, trajet, fenêtre (voir `BOSS_RULES.bonus`). */
    bonus: { chance: number; travelMs: number; earlyMs: number; lateMs: number }
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
 * atteint sa cible à mi-chemin, après un trajet plus court (`bonus.travelMs`),
 * sur une case et une corde libres (voir `bonusPosition`). Les notes sont rangées dans leur
 * ordre d'arrivée. Le calendrier ne bouge plus ensuite, quels que soient les
 * jugements ; le combat s'arrête dès que le boss ou le joueur tombe, notes
 * encore en vol comprises.
 */
export function createBossChart(
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  startAt: number,
  rules: ChartRules = BOSS_RULES,
): BossNote[] {
  const count = bossChartLength(rules)
  // Les notes du boss d'abord, chacune différente de la précédente.
  const regular: BossNote[] = []
  let previous: Challenge | null = null
  for (let i = 0; i < count; i++) {
    previous = createChallenge(i + 1, level, tuning, random, previous)
    const { stringIndex, fret, pc } = previous
    const launchAt = startAt + rules.startDelayMs + i * rules.intervalMs
    regular.push({ id: 0, stringIndex, fret, pc, launchAt, hitAt: launchAt + rules.travelMs })
  }
  // Puis les notes bonus, à mi-chemin de la suivante (jamais après la dernière),
  // chacune placée parmi toutes les notes déjà posées.
  const notes = regular.slice()
  for (let i = 0; i < count - 1; i++) {
    if (random() >= rules.bonus.chance) continue
    const hitAt = regular[i].hitAt + rules.intervalMs / 2
    const timing = { launchAt: hitAt - rules.bonus.travelMs, hitAt, bonus: true as const }
    const neighbours = [regular[i], regular[i + 1]]
    const position = bonusPosition(timing, neighbours, notes, level, tuning, random, rules)
    if (position) notes.push({ id: 0, ...position, ...timing })
  }
  return notes.sort((a, b) => a.hitAt - b.hitAt).map((note, index) => ({ ...note, id: index + 1 }))
}

type Timing = Pick<BossNote, 'launchAt' | 'hitAt' | 'bonus'>

/**
 * Présence d'une note à l'écran : de son départ (anneau et couloir paraissent)
 * jusqu'à la fin de sa fenêtre, plus le fondu d'un fantôme manqué.
 */
function onScreen(note: Timing, rules: ChartRules): { from: number; until: number } {
  return { from: note.launchAt, until: note.hitAt + windowOf(note, rules).lateMs + rules.fadeMs }
}

/**
 * Position d'une note bonus : sur une case et une corde qu'aucune autre note
 * n'occupe tant qu'elle est à l'écran. Couloirs et fantômes montent à la
 * verticale de leur cible : une colonne est une case quand le manche est à
 * l'horizontale, une corde quand il pivote en portrait (en plein combat, au
 * besoin). Case et corde libres, son couloir n'appartient qu'à elle : jamais de
 * file de notes dans sa colonne, dont l'ordre serait difficile à lire. Sa
 * touche diffère aussi de celles de ses deux voisines (`neighbours`). `null` si
 * aucune position ne convient : le bonus saute son tour (moins d'une fois sur
 * vingt avec le niveau actuel).
 */
function bonusPosition(
  timing: Timing,
  neighbours: readonly BossNote[],
  notes: readonly BossNote[],
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  rules: ChartRules,
): Pick<BossNote, 'stringIndex' | 'fret' | 'pc'> | null {
  const span = onScreen(timing, rules)
  const alongside = notes.filter((note) => {
    const other = onScreen(note, rules)
    return other.from < span.until && span.from < other.until
  })
  const frets = new Set(alongside.map((note) => note.fret))
  const strings = new Set(alongside.map((note) => note.stringIndex))
  const candidates: Pick<BossNote, 'stringIndex' | 'fret' | 'pc'>[] = []
  for (const stringIndex of level.strings) {
    for (let fret = level.frets.min; fret <= level.frets.max; fret++) {
      const pc = pitchClassAt(tuning, stringIndex, fret)
      if (frets.has(fret) || strings.has(stringIndex)) continue
      if (neighbours.some((note) => note.pc === pc)) continue
      candidates.push({ stringIndex, fret, pc })
    }
  }
  return candidates.length > 0 ? pick(candidates, random) : null
}
