/**
 * Jetons de mouvement partagés.
 *
 * Toutes les animations du jeu puisent ici leurs courbes et durées : un design
 * system de mouvement peut ainsi être branché en un seul endroit.
 * Les courbes sont au format cubic-bezier attendu par Motion (`ease: [...]`).
 */
export const ease = {
  /** Ease-out franc, attaque explosive puis atterrissage doux. Courbe de référence des révélations. */
  outExpo: [0.16, 1, 0.3, 1],
  /** Ease-out plus rond, pour les éléments secondaires. */
  outQuart: [0.25, 1, 0.5, 1],
  /** Léger dépassement, pour les « pops ». */
  outBack: [0.34, 1.56, 0.64, 1],
  /** Sortie rapide (disparitions). */
  inQuad: [0.11, 0, 0.5, 0],
} as const satisfies Record<string, readonly [number, number, number, number]>

/** Durées en secondes (unité de Motion). */
export const duration = {
  instant: 0.08,
  fast: 0.18,
  base: 0.3,
  reveal: 0.42,
  slow: 0.6,
} as const

/** Ressorts prêts à l'emploi. */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 },
  bouncy: { type: 'spring', stiffness: 420, damping: 18, mass: 0.8 },
  soft: { type: 'spring', stiffness: 180, damping: 24 },
} as const
