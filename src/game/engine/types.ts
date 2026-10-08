import type { LevelConfig } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'

export type GamePhase = 'ready' | 'playing' | 'won' | 'lost'

/** Une note à deviner : une position sur le manche. */
export interface Challenge {
  /** Identifiant unique sur toute la session (sert de clé aux effets). */
  id: number
  stringIndex: number
  fret: number
  pc: PitchClass
  /** Note proposée par le coup de pouce (voir `AssistState`). */
  assist?: boolean
}

/** Résultat d'une tentative — c'est ce que consomment les effets de révélation. */
export interface GuessResult {
  /** = `challenge.id` (une seule tentative par note). */
  id: number
  challenge: Challenge
  /** Note jouée, ou `null` si le temps s'est écoulé avant toute réponse. */
  guess: PitchClass | null
  correct: boolean
  /** Série de bonnes réponses consécutives, tentative incluse (0 après une erreur). */
  streak: number
  /** Horodatage `performance.now()` de la tentative. */
  at: number
  /** Temps de réaction (ms) depuis l'apparition du point ; `null` si le temps s'est écoulé. */
  reactionMs: number | null
  /** Points du barème, avant multiplicateur (0 sur une erreur). */
  basePoints: number
  /** Multiplicateur appliqué (2 pendant un combo, sinon 1). */
  multiplier: number
  /** Points marqués : `basePoints × multiplier`. */
  points: number
  /** Cette réponse a déclenché le combo (elle-même n'est pas multipliée). */
  comboTriggered: boolean
  /** Réponse à une note du coup de pouce (jamais multipliée, sans effet sur le combo). */
  assisted: boolean
}

/** Coup de pouce en cours : la même note, proposée `total` fois de suite. */
export interface AssistState {
  /** Note répétée : celle qui vient d'être révélée quand le coup de pouce a été offert. */
  pc: PitchClass
  /** Notes proposées au total, et notes encore à venir. */
  total: number
  remaining: number
}

/** Combo en cours : actif tant que `performance.now() < endsAt`. */
export interface ComboState {
  /** Instant du déclenchement. */
  startedAt: number
  /** Fin prévue, repoussée par chaque bonne réponse rapide (plafonnée, voir `COMBO_RULES`). */
  endsAt: number
}

export interface GameState {
  levelIndex: number
  level: LevelConfig
  phase: GamePhase
  challenge: Challenge | null
  /** `performance.now()` à l'apparition de la note en cours : origine du temps de réaction. */
  challengeShownAt: number | null
  /** Saisie bloquée pendant la révélation. */
  locked: boolean
  correctCount: number
  mistakes: number
  streak: number
  bestStreak: number
  /** Score de la partie. */
  score: number
  /** Bonnes réponses rapides consécutives hors combo (le combo se déclenche à `COMBO_RULES.triggerCount`). */
  fastStreak: number
  /** Combo en cours, ou `null`. */
  combo: ComboState | null
  /** Coup de pouce en cours, ou `null`. */
  assist: AssistState | null
  /** Le coup de pouce a déjà été offert dans cette partie (une seule fois). */
  assistUsed: boolean
  /** `performance.now()` au lancement du niveau. */
  startedAt: number | null
  /** `performance.now()` à la victoire ou à l'expiration du temps. */
  endedAt: number | null
  lastResult: GuessResult | null
  results: readonly GuessResult[]
}

export type GameAction =
  | { type: 'load'; levelIndex: number }
  | { type: 'start'; now: number; challenge: Challenge }
  /**
   * `roll` : tirage dans [0, 1) pour le coup de pouce (injecté pour garder le
   * réducteur pur) ; absent, aucun coup de pouce n'est offert.
   */
  | { type: 'guess'; pc: PitchClass; now: number; roll?: number }
  | { type: 'next'; challenge: Challenge; now: number }
  | { type: 'timeUp'; now: number }
  | { type: 'comboExpire'; now: number }
