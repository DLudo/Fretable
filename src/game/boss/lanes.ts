import { BOSS_RULES } from '@/game/config'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BossNote } from './types'

type Point = { x: number; y: number }

/**
 * Couloir d'une note, en mm du manche : de la zone de lancement, sous le bord
 * bas du manche (`launchMm`), jusqu'à la cible. Le bas du manche est le côté des
 * y positifs (Mi grave), le fantôme « monte » donc vers les y négatifs.
 */
export function laneFor(
  layout: NeckLayout,
  note: Pick<BossNote, 'stringIndex' | 'fret'>,
  launchMm: number = BOSS_RULES.launchMm,
): { target: Point; launch: Point } {
  const target = layout.position(note.stringIndex, note.fret)
  return { target, launch: { x: target.x, y: layout.halfWidthAt(target.x) + launchMm } }
}

/**
 * Ordonnée du fantôme à l'instant `now` : il monte à vitesse constante et
 * atteint la cible pile à `hitAt`, puis continue au-delà. Avant d'avoir franchi
 * la zone de lancement, il est sous elle (y plus grand que celui du lancement).
 */
export function ghostY(
  target: Point,
  hitAt: number,
  now: number,
  speedMmPerSec: number = BOSS_RULES.ghostSpeedMmPerSec,
): number {
  return target.y + (speedMmPerSec * (hitAt - now)) / 1000
}
