import { COIN_RULES } from '@/game/config'

export type CoinRules = typeof COIN_RULES

/** Pièces gagnées à la fin d'une partie. */
export interface CoinReward {
  /** Conversion du score (1 000 points = 100 pièces). */
  fromScore: number
  /** Prime de victoire, selon les étoiles (0 sur une défaite, ou sans étoiles). */
  completion: number
  /** Étoiles qui ont valu la prime (0 sans prime). */
  stars: number
  total: number
}

/** Conversion du score en pièces, arrondie à la pièce inférieure. */
export function coinsForScore(score: number, rules: CoinRules = COIN_RULES): number {
  return Math.floor(Math.max(0, score) / rules.pointsPerCoin)
}

/** Prime de victoire pour `stars` étoiles (bornées à celles du barème). */
export function completionCoins(stars: number, rules: CoinRules = COIN_RULES): number {
  const rank = Math.min(rules.starBonus.length - 1, Math.max(0, Math.floor(stars)))
  return rules.starBonus[rank]
}

/**
 * Pièces d'une partie terminée : son score converti, plus la prime de ses
 * étoiles. Une défaite vaut zéro étoile : seul son score est converti.
 */
export function coinReward(
  { score, stars }: { score: number; stars: number },
  rules: CoinRules = COIN_RULES,
): CoinReward {
  const fromScore = coinsForScore(score, rules)
  const completion = completionCoins(stars, rules)
  return { fromScore, completion, stars: completion > 0 ? stars : 0, total: fromScore + completion }
}
