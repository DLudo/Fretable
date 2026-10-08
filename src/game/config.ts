/**
 * Réglages de « game feel » : tout ce qui touche au rythme ressenti.
 * Centralisés ici pour être ajustés sans fouiller les composants.
 */
export const GAME_FEEL = {
  /** Durée pendant laquelle la saisie est bloquée après une bonne réponse (ms). */
  holdAfterCorrectMs: 420,
  /** Idem après une erreur : un peu plus long pour laisser lire la bonne note. */
  holdAfterWrongMs: 950,
  /** Délai avant l'affichage de l'écran de victoire, pour laisser vivre la dernière révélation (ms). */
  victoryDelayMs: 650,
  /**
   * Délai avant l'écran « Temps écoulé » quand une révélation joue encore
   * (note révélée faute de réponse, ou erreur juste avant la fin) : le temps de lire la note (ms).
   */
  defeatDelayMs: 950,
  /** En dessous de ce temps restant, le timer passe en alerte (ms). */
  criticalTimeMs: 10_000,
  /** Série au-delà de laquelle l'intensité des effets est maximale. */
  maxStreakIntensity: 6,
} as const

/**
 * Barème des points selon le temps de réaction (ms) : temps écoulé entre
 * l'apparition du point et la réponse. Seules les bonnes réponses marquent.
 */
export const SCORING = {
  /** Coup critique : 0,5 s ou moins. */
  criticalMs: 500,
  criticalPoints: 1000,
  /** Paliers suivants, du plus rapide au plus lent : temps strictement inférieur à `belowMs`. */
  tiers: [
    { belowMs: 1000, points: 600 },
    { belowMs: 2000, points: 400 },
    { belowMs: 3000, points: 300 },
    { belowMs: 5000, points: 200 },
    { belowMs: 10_000, points: 100 },
  ],
  /** 10 s et plus. */
  slowPoints: 50,
} as const

/**
 * Combo : trois bonnes réponses rapides d'affilée allument le manche et
 * doublent les points des notes suivantes, tant que la jauge n'est pas vide.
 */
export const COMBO_RULES = {
  /** Bonnes réponses rapides consécutives nécessaires pour déclencher le combo. */
  triggerCount: 3,
  /** Réponse « rapide » : temps de réaction strictement inférieur (ms). */
  fastReactionMs: 3000,
  /** Durée du combo à son déclenchement (ms). Les amplis l'allongeront. */
  durationMs: 6000,
  /** Recharge apportée par chaque bonne réponse rapide pendant le combo (ms). */
  rechargeMs: 2000,
  /** Plafond de la jauge (ms) : une recharge ne la fait jamais dépasser. */
  maxMs: 6000,
  /** Multiplicateur des points pendant le combo. */
  multiplier: 2,
} as const

/**
 * Coup de pouce : un joueur en difficulté (temps de réaction moyen trop long)
 * peut se voir offrir, une fois par partie, la même note plusieurs fois de suite.
 */
export const ASSIST_RULES = {
  /** Temps de réaction moyen au-delà duquel le coup de pouce peut être offert (ms). */
  averageAboveMs: 5000,
  /** Réponses nécessaires avant de juger la moyenne. */
  minAnswers: 2,
  /** Chance d'être offert, tirée après chaque réponse tant que la moyenne dépasse le seuil. */
  chance: 0.3,
  /** Nombre de fois où la même note est proposée. */
  repeats: 3,
  /**
   * `false` : la même note à des endroits différents du manche (on apprend ses positions) ;
   * `true` : exactement le même point, trois fois.
   */
  samePosition: false,
} as const

/** Notation affichée partout (piano, révélations). */
export const NOTATION = 'solfege' as const
