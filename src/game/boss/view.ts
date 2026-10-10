import { BOSS_RULES } from '@/game/config'
import type { BossHit, BossNote, BossState } from './types'

/** Note à dessiner : en vol (`hit` nul) ou jugée, le temps de ses retours. */
export interface VisibleBossNote {
  note: BossNote
  hit: BossHit | null
  /** La note à jouer maintenant : la première pas encore jugée. */
  current: boolean
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
      if (now - hit.at <= feedbackMs) shown.push({ note, hit, current: false })
      return
    }
    if (state.phase === 'playing' && now >= note.launchAt) {
      shown.push({ note, hit, current: index === state.cursor })
    }
  })
  return shown
}
