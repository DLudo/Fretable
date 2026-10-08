import { COMBO_RULES, SCORING } from '@/game/config'
import type { ComboState } from './types'

/** Points du barème pour une bonne réponse donnée en `reactionMs`. */
export function basePoints(reactionMs: number): number {
  if (reactionMs <= SCORING.criticalMs) return SCORING.criticalPoints
  for (const tier of SCORING.tiers) if (reactionMs < tier.belowMs) return tier.points
  return SCORING.slowPoints
}

/** Coup critique : réponse en 0,5 s ou moins. */
export function isCritical(reactionMs: number): boolean {
  return reactionMs <= SCORING.criticalMs
}

/** Réponse assez rapide pour nourrir le combo. */
export function isFastReaction(reactionMs: number): boolean {
  return reactionMs < COMBO_RULES.fastReactionMs
}

/** Le combo court encore à l'instant `now`. */
export function isComboLive(combo: ComboState | null, now: number): combo is ComboState {
  return combo !== null && now < combo.endsAt
}

export interface ComboStep {
  combo: ComboState | null
  fastStreak: number
  /** Multiplicateur applicable à cette réponse. */
  multiplier: number
  /** Cette réponse vient de déclencher le combo. */
  triggered: boolean
}

/**
 * Fait avancer le combo d'une réponse.
 *
 * - Hors combo : les bonnes réponses rapides s'enchaînent ; toute erreur ou
 *   réponse lente remet le compte à zéro. À la troisième, le combo démarre
 *   pour `durationMs` ; cette réponse-là n'est pas encore multipliée.
 * - Pendant le combo : chaque réponse est multipliée, qu'elle soit juste ou
 *   non (seules les justes rapportent). Une bonne réponse rapide recharge la
 *   jauge de `rechargeMs`, sans dépasser `maxMs` d'avance. Une erreur ne
 *   l'interrompt pas : seul le temps l'épuise.
 * - Combo épuisé : il faut à nouveau trois bonnes réponses rapides.
 */
export function stepCombo(
  combo: ComboState | null,
  fastStreak: number,
  answer: { now: number; correct: boolean; reactionMs: number },
): ComboStep {
  const { now, correct, reactionMs } = answer
  const fast = correct && isFastReaction(reactionMs)

  if (isComboLive(combo, now)) {
    const endsAt = fast
      ? Math.min(now + COMBO_RULES.maxMs, combo.endsAt + COMBO_RULES.rechargeMs)
      : combo.endsAt
    return {
      combo: endsAt === combo.endsAt ? combo : { ...combo, endsAt },
      fastStreak: 0,
      multiplier: COMBO_RULES.multiplier,
      triggered: false,
    }
  }

  // Un combo arrivé à échéance (sans que `comboExpire` soit encore passé) ne compte plus.
  const streak = fast ? (combo ? 0 : fastStreak) + 1 : 0
  if (streak >= COMBO_RULES.triggerCount) {
    return {
      combo: { startedAt: now, endsAt: now + COMBO_RULES.durationMs },
      fastStreak: 0,
      multiplier: 1,
      triggered: true,
    }
  }
  return { combo: null, fastStreak: streak, multiplier: 1, triggered: false }
}
