import type { BossNote } from './types'

type Point = { x: number; y: number }

/**
 * Avancement du fantôme sur son trajet à l'instant `now` : 0 au départ (bas de
 * l'écran), 1 sur la cible (`hitAt`) ; au-delà de 1, il la dépasse, à la même
 * vitesse, ou à celle d'un trajet de `overshootSpanMs` s'il est donné. Négatif :
 * il n'est pas encore parti.
 */
export function ghostProgress(
  note: Pick<BossNote, 'launchAt' | 'hitAt'>,
  now: number,
  overshootSpanMs?: number,
): number {
  const span = note.hitAt - note.launchAt
  if (span <= 0) return 1
  if (now <= note.hitAt || !overshootSpanMs) return (now - note.launchAt) / span
  return 1 + (now - note.hitAt) / overshootSpanMs
}

/** Point situé à la fraction `t` du segment `from` → `to` (au-delà de 1, dans le prolongement). */
export function lerpPoint(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}
