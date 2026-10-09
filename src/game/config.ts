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
  /**
   * Décompte avant chaque partie : 3, 2, 1, puis la première note, et le temps
   * se met à courir. 0 : la partie démarre aussitôt.
   */
  startCountdownFrom: 3,
  /** Durée de chaque chiffre du décompte (ms). */
  startCountdownStepMs: 1000,
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
 * Les répétitions ne valent ensemble qu'un cran de progression, mais l'aide
 * accorde du temps supplémentaire.
 */
export const ASSIST_RULES = {
  /** Temps de réaction moyen au-delà duquel le coup de pouce peut être offert (ms). */
  averageAboveMs: 5000,
  /** Réponses nécessaires avant de juger la moyenne. */
  minAnswers: 2,
  /** Chance d'être offert, tirée après chaque réponse tant que la moyenne dépasse le seuil. */
  chance: 0.3,
  /**
   * Bonnes réponses attendues sur la note répétée ; ensemble, elles valent un
   * seul cran de progression. Une erreur ne consomme pas de répétition : la
   * note revient jusqu'à être trouvée autant de fois.
   */
  repeats: 3,
  /** Temps ajouté à la partie quand le coup de pouce est offert (ms). */
  bonusTimeMs: 10_000,
  /**
   * `false` : la même note à des endroits différents du manche (on apprend ses positions) ;
   * `true` : exactement le même point, trois fois.
   */
  samePosition: false,
} as const

/** Notation affichée partout (piano, révélations). */
export const NOTATION = 'solfege' as const

/**
 * Bonus de mode, première étape : à tout moment de la partie, trois notes
 * peuvent former une triade jouable (fondamentale, tierce, quinte sur trois cordes voisines).
 * Trouvées toutes trois, chacune en moins de `fastReactionMs`, elles ouvrent le
 * parcours de gamme. Les notes de la triade ne nourrissent ni le combo ni le
 * coup de pouce.
 */
export const TRIAD_RULES = {
  /** Chance, à chaque nouvelle note où c'est possible, qu'une triade commence. */
  chance: 0.2,
  /** Triades au plus par partie (`Infinity` : aucune limite). */
  maxPerGame: Number.POSITIVE_INFINITY,
  /**
   * Notes ordinaires à jouer entre la fin d'une triade (ou de son parcours de
   * gamme) et le début de la suivante : elles ne s'enchaînent jamais.
   */
  minNotesBetween: 4,
  /**
   * Notes qu'il doit rester à trouver quand la triade commence : ses trois
   * notes, plus une, pour que la partie ne s'achève pas sur la triade.
   */
  minNotesLeft: 4,
  /** Temps de réaction maximal, par note, pour réussir la triade (ms). */
  fastReactionMs: 2000,
  /** Écart maximal entre la plus basse et la plus haute case de la triade. */
  maxFretSpan: 3,
  /** Qualités tirées au sort (le palier 1 ajoutera les autres). */
  qualities: ['major', 'minor'],
} as const

/**
 * Bonus de mode, seconde étape : une triade réussie dessine sur le manche la
 * forme de gamme qui la prolonge ; le joueur la parcourt du grave à l'aigu,
 * jusqu'au bout. Le temps de la partie est suspendu pendant le parcours, qui ne
 * compte pas pour la progression.
 */
export const SCALE_RULES = {
  /**
   * Gammes accessibles. Sans le palier 1 débloqué, le bonus s'en tient à la
   * pentatonique ; une liste vide coupe le parcours (la triade reste).
   */
  kinds: ['pentatonic'] as readonly 'pentatonic'[],
  /** Points par note juste du parcours. */
  pointsPerNote: 150,
  /** Supplément pour un parcours sans faute. */
  perfectBonus: 1000,
} as const

/**
 * Notation de fin de niveau, de une à trois étoiles. Une étoile récompense le
 * niveau réussi ; les suivantes dépendent d'un indice qui mêle le score et la
 * part du temps restante :
 *
 *   indice = scoreWeight × min(1, score retenu / score de référence)
 *          + (1 − scoreWeight) × min(1, part de temps restante / referenceTimeShare)
 *
 * Le coup de pouce est neutralisé : le temps qu'il accorde ne compte pas, et ses
 * trois bonnes réponses ne pèsent qu'une note (la moyenne de leurs points).
 * Chaque niveau peut surcharger ces réglages (`LevelConfig.rating`).
 */
export const RATING_RULES = {
  /** Poids du score dans l'indice ; la part de temps restante pèse le complément. */
  scoreWeight: 0.6,
  /** Indice minimal pour deux étoiles. */
  twoStarsAt: 0.5,
  /** Indice minimal pour trois étoiles. */
  threeStarsAt: 0.85,
  /**
   * Part du temps du niveau qu'il faut garder en réserve pour la note maximale
   * côté temps (0,63 = 63 %). Figée : raccourcir le compte à rebours rend donc
   * les étoiles plus exigeantes, en même temps que le niveau. 63 % correspond
   * à une allure de 1,5 s par note sans erreur, sur 6 notes en 30 s comme sur
   * les 24 notes en 2 minutes du niveau 1.
   */
  referenceTimeShare: 0.63,
  /**
   * Allure étalon (ms par note, sans erreur) : le score qu'elle rapporte, combo
   * compris, vaut la note maximale côté score (18 000 points au niveau 1).
   */
  referencePaceMs: 1500,
  /** Étoiles au plus quand le coup de pouce a servi (3 : aucun plafond). */
  maxStarsWithAssist: 3,
}

export type RatingRules = typeof RATING_RULES
