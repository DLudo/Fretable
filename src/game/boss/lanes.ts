import { BOSS_RULES } from '@/game/config'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BoardOrientation } from '@/game/fretboard/projection'
import type { BossNote } from './types'

type Point = { x: number; y: number }

/** Couloir d'une note, en mm du manche : de son point de lancement jusqu'à la cible. */
export interface BossLane {
  target: Point
  launch: Point
  /** Vecteur unitaire de la cible vers le lancement : le fantôme arrive de là. */
  dir: Point
  /** Longueur du couloir (mm). */
  length: number
}

/**
 * Couloir d'une note, pour que le fantôme « monte » à l'écran :
 * - manche à l'horizontale : du bord bas du manche (côté Mi grave, y positifs),
 *   `launchMm` plus bas, jusqu'à la cible ;
 * - manche à la verticale (portrait, sillet en haut) : le long de la corde,
 *   depuis `portraitLaneMm` plus bas côté caisse (sans dépasser le bout du
 *   manche de plus de `launchMm`), jusqu'à la cible.
 */
export function laneFor(
  layout: NeckLayout,
  note: Pick<BossNote, 'stringIndex' | 'fret'>,
  orientation: BoardOrientation = 'horizontal',
  rules: Pick<typeof BOSS_RULES, 'launchMm' | 'portraitLaneMm'> = BOSS_RULES,
): BossLane {
  const target = layout.position(note.stringIndex, note.fret)
  let launch: Point
  if (orientation === 'vertical') {
    const x = Math.min(target.x + rules.portraitLaneMm, layout.endX + rules.launchMm)
    launch = { x, y: layout.stringY(note.stringIndex, x) }
  } else {
    launch = { x: target.x, y: layout.halfWidthAt(target.x) + rules.launchMm }
  }
  const length = Math.hypot(launch.x - target.x, launch.y - target.y)
  const dir = { x: (launch.x - target.x) / length, y: (launch.y - target.y) / length }
  return { target, launch, dir, length }
}

/**
 * Distance du fantôme à la cible à l'instant `now` (mm, côté lancement) : il
 * avance à vitesse constante, touche la cible pile à `hitAt` (0), puis la
 * dépasse (valeurs négatives). Au-delà de `lane.length`, il n'a pas encore paru.
 */
export function ghostOffset(
  hitAt: number,
  now: number,
  speedMmPerSec: number = BOSS_RULES.ghostSpeedMmPerSec,
): number {
  return (speedMmPerSec * (hitAt - now)) / 1000
}

/** Position du fantôme sur son couloir, à `offset` mm de la cible. */
export function ghostPoint(lane: BossLane, offset: number): Point {
  return { x: lane.target.x + lane.dir.x * offset, y: lane.target.y + lane.dir.y * offset }
}
