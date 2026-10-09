import type { LevelConfig } from '@/game/levels/levels'
import type { TriadQuality, TriadVoicing } from '@/game/music/chords'
import type { PitchClass } from '@/game/music/notes'

/** `starting` : décompte 3, 2, 1 avant la première note (le temps ne court pas encore). */
export type GamePhase = 'ready' | 'starting' | 'playing' | 'won' | 'lost'

/** Une note à deviner : une position sur le manche. */
export interface Challenge {
  /** Identifiant unique sur toute la session (sert de clé aux effets). */
  id: number
  stringIndex: number
  fret: number
  pc: PitchClass
  /** Note proposée par le coup de pouce (voir `AssistState`). */
  assist?: boolean
  /** Note d'une triade (voir `TriadState`). */
  triad?: boolean
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
  /**
   * Réponse à une note de bonus (`triad`) : jamais multipliée, elle ne nourrit
   * ni le combo ni le coup de pouce.
   */
  bonus?: 'triad'
}

/**
 * Coup de pouce en cours : la même note revient jusqu'à être trouvée `total`
 * fois ; ces bonnes réponses valent ensemble un seul cran de progression.
 */
export interface AssistState {
  /** Note répétée : celle qui vient d'être révélée quand le coup de pouce a été offert. */
  pc: PitchClass
  /** Bonnes réponses attendues au total, et celles qui manquent encore. */
  total: number
  remaining: number
}

/** Triade en cours : ses trois notes sont demandées l'une après l'autre. */
export interface TriadState extends TriadVoicing {
  /** Index de la note demandée (0 : fondamentale, 1 : tierce, 2 : quinte). */
  step: number
  /** Toutes les réponses jusqu'ici justes, et chacune assez rapide. */
  clean: boolean
}

/** Issue de la dernière triade. */
export interface TriadOutcome {
  /** Identifiant de sa dernière note (sert de clé à l'annonce). */
  id: number
  root: PitchClass
  quality: TriadQuality
  /** Trois bonnes réponses, chacune en moins de `TRIAD_RULES.fastReactionMs`. */
  success: boolean
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
  /** Temps accordé en plus de `level.durationMs` (coup de pouce), en ms. */
  bonusTimeMs: number
  /** Triade en cours, ou `null`. */
  triad: TriadState | null
  /** Triades commencées dans cette partie (voir `TRIAD_RULES.maxPerGame`). */
  triadsStarted: number
  /** Issue de la dernière triade, ou `null`. */
  lastTriad: TriadOutcome | null
  /** `performance.now()` au début du décompte 3, 2, 1 (phase `starting`). */
  startingAt: number | null
  /** `performance.now()` au lancement du niveau : apparition de la première note. */
  startedAt: number | null
  /** `performance.now()` à la victoire ou à l'expiration du temps. */
  endedAt: number | null
  lastResult: GuessResult | null
  results: readonly GuessResult[]
}

export type GameAction =
  | { type: 'load'; levelIndex: number }
  /** Lance le décompte 3, 2, 1 ; `start` suivra à son terme. */
  | { type: 'prepare'; now: number }
  | { type: 'start'; now: number; challenge: Challenge }
  /**
   * `roll` : tirage dans [0, 1) pour le coup de pouce (injecté pour garder le
   * réducteur pur) ; absent, aucun coup de pouce n'est offert.
   */
  | { type: 'guess'; pc: PitchClass; now: number; roll?: number }
  /**
   * `triad` : la note suivante ouvre cette triade (`challenge` est sa
   * fondamentale) ; ignorée si une triade ne peut pas commencer (`canStartTriad`).
   */
  | { type: 'next'; challenge: Challenge; now: number; triad?: TriadVoicing }
  | { type: 'timeUp'; now: number }
  | { type: 'comboExpire'; now: number }
