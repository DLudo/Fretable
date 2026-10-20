import { SCORING } from '@/game/config'
import type { GuessResult } from '@/game/engine/types'
import { range, seededRandom } from '@/lib/random'

/**
 * Teinte d'un nombre flottant, du plus éclatant au plus sobre :
 * - `crit` : coup critique (réponse en 0,5 s ou moins), le plus gros, doré ;
 * - `fire` : points triplés par le combo enflammé du boss ;
 * - `combo` : points doublés par le combo ;
 * - `triad` : note de triade doublée par son anneau ; `scale` : note du parcours de gamme ;
 * - `assist` : note du coup de pouce, ou note bonus du boss (toutes deux ambrées) ;
 * - `normal` : le reste.
 */
export type ScorePopTone = 'crit' | 'fire' | 'combo' | 'triad' | 'scale' | 'assist' | 'normal'

/**
 * Coup critique : réponse juste en 0,5 s ou moins (le palier des 1 000 points).
 * Les notes du parcours de gamme, payées au forfait, n'en sont jamais.
 */
export function isCriticalHit(result: GuessResult): boolean {
  return (
    result.correct &&
    result.bonus !== 'scale' &&
    result.reactionMs !== null &&
    result.reactionMs <= SCORING.criticalMs
  )
}

/** Teinte d'une bonne réponse : le coup critique l'emporte sur tout le reste. */
export function scorePopTone(result: GuessResult): ScorePopTone {
  if (isCriticalHit(result)) return 'crit'
  if (result.bonus === 'scale') return 'scale'
  if (result.assisted) return 'assist'
  if (result.multiplier >= 3) return 'fire'
  if (result.multiplier === 2) return result.bonus === 'triad' ? 'triad' : 'combo'
  return 'normal'
}

/** Trajectoire et taille d'un nombre flottant (px, s). */
export interface ScorePopMotion {
  /** Taille du chiffre. */
  fontSize: number
  /** Dérive latérale à la fin de la course (négative : vers la gauche). */
  dx: number
  /** Hauteur de la montée. */
  rise: number
  /** Inclinaison au jaillissement (degrés), qui se redresse : coups critiques seulement. */
  tilt: number
  /** Durée de vie, du jaillissement à l'effacement. */
  durationS: number
}

/** Le chiffre suit la taille du repère, dans ces bornes (px). */
const MIN_FONT = 18
const MAX_FONT = 34
/** Taille relative de chaque teinte : le critique écrase les autres. */
const TONE_SCALE: Record<ScorePopTone, number> = {
  crit: 1.6,
  fire: 1.18,
  combo: 1.12,
  triad: 1.12,
  assist: 1,
  normal: 1,
  scale: 0.85,
}

/** Hauteur d'un nombre flottant, en tailles de chiffre (« Critique » compris). */
const POP_HEIGHT = 1.05
const CRIT_POP_HEIGHT = 1.5

/**
 * Trajectoire d'un nombre flottant, à la manière des dégâts d'un MMORPG : il
 * jaillit du repère, monte en s'écartant d'un côté, puis s'efface. La graine
 * (l'identifiant de la réponse) varie le côté et l'amplitude d'un nombre à
 * l'autre, pour que deux réponses rapprochées ne se superposent pas.
 *
 * `room` : place (px) au-dessus du point de départ, jusqu'au haut de la scène.
 * Le nombre n'en sort pas : à court de hauteur, il monte moins et s'écarte
 * davantage (une note de la corde aiguë, sur un téléphone).
 */
export function scorePopMotion(
  seed: number,
  markerSize: number,
  tone: ScorePopTone,
  room = Infinity,
): ScorePopMotion {
  const random = seededRandom(Math.imul(seed, 0x9e3779b1))
  const crit = tone === 'crit'
  const fontSize = Math.round(
    Math.min(MAX_FONT, Math.max(MIN_FONT, markerSize * 1.15)) * TONE_SCALE[tone],
  )
  const side = random() < 0.5 ? -1 : 1
  const drift = range(random, 0.6, 1.6)
  const wanted = range(random, 2.6, 3.4) * fontSize * (crit ? 1.1 : 1)
  const rise = Math.min(
    wanted,
    Math.max(0, room - fontSize * (crit ? CRIT_POP_HEIGHT : POP_HEIGHT)),
  )
  return {
    fontSize,
    // Ce qu'il ne peut gagner en hauteur, il le prend en largeur.
    dx: side * (drift * fontSize + (wanted - rise) * 0.6),
    rise,
    tilt: crit ? side * range(random, 8, 14) : 0,
    durationS: crit ? 1.35 : 1.05,
  }
}
