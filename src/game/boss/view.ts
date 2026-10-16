import { BOSS_RULES } from '@/game/config'
import type { BossHit, BossNote, BossState } from './types'

/** Note à dessiner : en vol (`hit` nul) ou jugée, le temps de ses retours. */
export interface VisibleBossNote {
  note: BossNote
  hit: BossHit | null
  /** La note à jouer maintenant : la première pas encore jugée. */
  current: boolean
  /** Rang dans la file des notes en vol : 0 pour celle à jouer, 1 pour la suivante… ; -1 si jugée. */
  rank: number
}

/**
 * Opacité de l'anneau d'arrivée selon le rang dans la file : pleine pour la note
 * à jouer, puis 50 %, puis 25 % pour les suivantes. À chaque jugement, chaque
 * anneau monte d'un cran.
 */
export const TARGET_OPACITY_BY_RANK = [1, 0.5, 0.25] as const

export function targetOpacity(rank: number): number {
  if (rank < 0) return 1
  return TARGET_OPACITY_BY_RANK[Math.min(rank, TARGET_OPACITY_BY_RANK.length - 1)]
}

/**
 * Notes à dessiner à l'instant `now` : toutes celles en vol (parties et pas
 * encore jugées), la première étant celle à jouer, plus les notes jugées depuis
 * moins de `feedbackMs`, le temps de leurs retours. Combat fini, plus aucune
 * note en vol.
 */
export function visibleBossNotes(
  state: Pick<BossState, 'phase' | 'notes' | 'hits' | 'cursor'>,
  now: number,
  feedbackMs: number = BOSS_RULES.fadeMs,
): VisibleBossNote[] {
  const shown: VisibleBossNote[] = []
  state.notes.forEach((note, index) => {
    const hit = state.hits[index] ?? null
    if (hit) {
      if (now - hit.at <= feedbackMs) shown.push({ note, hit, current: false, rank: -1 })
      return
    }
    if (state.phase === 'playing' && now >= note.launchAt) {
      const rank = index - state.cursor
      shown.push({ note, hit, current: rank === 0, rank })
    }
  })
  return shown
}
