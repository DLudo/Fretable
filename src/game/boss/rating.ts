import { BOSS_RULES } from '@/game/config'
import type { StarCount } from '@/game/engine/rating'
import type { BossState } from './types'

/** Note d'un combat contre le boss. */
export interface BossRating {
  /** 0 sur une défaite, de 1 à 3 sur une victoire. */
  stars: StarCount
  /** Part de vie restante, dans [0, 1]. */
  index: number
}

/**
 * Note d'un combat fini, selon la vie qui reste au joueur quand le boss tombe :
 * plus des deux tiers, trois étoiles ; au moins un tiers, deux ; moins, une.
 * Une défaite n'en vaut aucune.
 */
export function rateBossFight(
  state: Pick<BossState, 'phase' | 'life'>,
  rules: {
    life: { max: number }
    rating: { parts: number; threeStarsAbove: number; twoStarsFrom: number }
  } = BOSS_RULES,
): BossRating {
  const max = rules.life.max
  const index = max > 0 ? Math.min(1, Math.max(0, state.life / max)) : 0
  if (state.phase !== 'won') return { stars: 0, index }
  // En parts entières (vie × 3 contre max × 2) : pas d'arrondi flottant aux seuils.
  const { parts, threeStarsAbove, twoStarsFrom } = rules.rating
  const scaled = state.life * parts
  const stars: StarCount = scaled > max * threeStarsAbove ? 3 : scaled >= max * twoStarsFrom ? 2 : 1
  return { stars, index }
}
