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
  /** En dessous de ce temps restant, le timer passe en alerte (ms). */
  criticalTimeMs: 10_000,
  /** Série au-delà de laquelle l'intensité des effets est maximale. */
  maxStreakIntensity: 6,
} as const

/** Notation affichée partout (piano, révélations). */
export const NOTATION = 'solfege' as const
