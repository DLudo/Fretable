import { BOSS_RULES } from '@/game/config'
import type { BossHit, BossNote, BossState } from './types'

/**
 * Notes à dessiner à l'instant `now` : la note en cours (une seule en vol, et
 * seulement une fois partie), plus les notes jugées depuis moins de
 * `feedbackMs`, le temps de leurs retours. La note suivante n'apparaît jamais
 * avant le jugement de la note en cours, même si son départ provisoire est
 * passé (frappe tardive, raté) : elle part à l'instant du jugement.
 */
export function visibleBossNotes(
  state: Pick<BossState, 'phase' | 'notes' | 'hits' | 'cursor'>,
  now: number,
  feedbackMs: number = BOSS_RULES.fadeMs,
): { note: BossNote; hit: BossHit | null }[] {
  const shown: { note: BossNote; hit: BossHit | null }[] = []
  state.notes.forEach((note, index) => {
    const hit = state.hits[index] ?? null
    if (hit) {
      if (now - hit.at <= feedbackMs) shown.push({ note, hit })
      return
    }
    if (state.phase === 'playing' && index === state.cursor && now >= note.launchAt) {
      shown.push({ note, hit })
    }
  })
  return shown
}
