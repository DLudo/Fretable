import { ASSIST_RULES, COMBO_RULES, SCALE_RULES, SCORING, TRIAD_RULES } from '@/game/config'
import type { LevelConfig } from '@/game/levels/levels'

/**
 * Plafond du score d'une partie classique : une borne haute, jamais atteinte
 * en jeu, qui sert à fixer le prix des objets qui multiplient le score.
 *
 * - Chaque bonne réponse vaut au plus un coup critique, doublé (combo ou note
 *   de triade : les multiplicateurs ne se cumulent jamais). Il y en a autant
 *   que de notes à trouver, plus les répétitions du coup de pouce, qui ne
 *   valent ensemble qu'un cran.
 * - Chaque triade réussie peut ouvrir un parcours de gamme : deux notes par
 *   corde, toutes justes, et le supplément d'un parcours sans faute. Une
 *   triade consomme trois notes, et ne commence qu'avec assez de notes
 *   restantes (`TRIAD_RULES.minNotesLeft`) ; les notes ordinaires qui les
 *   séparent peuvent être des erreurs, qui ne font pas avancer la partie.
 */
export function maxClassicScore(level: LevelConfig): number {
  const answers = level.targetCount + ASSIST_RULES.repeats - 1
  const perAnswer = SCORING.criticalPoints * COMBO_RULES.multiplier
  const triads = Math.max(0, Math.floor((level.targetCount - TRIAD_RULES.minNotesLeft) / 3) + 1)
  const scaleRun = 2 * level.strings.length * SCALE_RULES.pointsPerNote + SCALE_RULES.perfectBonus
  return answers * perAnswer + triads * scaleRun
}
