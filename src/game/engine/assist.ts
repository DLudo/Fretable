import { ASSIST_RULES } from '@/game/config'
import type { GuessResult } from './types'

/** Temps de réaction moyen des réponses données (les notes non répondues ne comptent pas). */
export function averageReactionMs(results: readonly GuessResult[]): number | null {
  const times = results.flatMap((r) => (r.reactionMs === null ? [] : [r.reactionMs]))
  if (times.length === 0) return null
  return times.reduce((sum, t) => sum + t, 0) / times.length
}

/**
 * Le coup de pouce est-il offert après cette réponse ?
 * Il faut assez de réponses pour juger, une moyenne au-dessus du seuil, et un
 * tirage favorable ; le tirage est refait à chaque réponse tant que la
 * condition tient, jusqu'à ce qu'il soit offert (une fois par partie).
 */
export function shouldOfferAssist(results: readonly GuessResult[], roll: number): boolean {
  const answered = results.filter((r) => r.reactionMs !== null).length
  if (answered < ASSIST_RULES.minAnswers) return false
  const average = averageReactionMs(results)
  return average !== null && average > ASSIST_RULES.averageAboveMs && roll < ASSIST_RULES.chance
}
