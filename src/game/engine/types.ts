import type { LevelConfig } from '@/game/levels/levels'
import type { TriadQuality, TriadVoicing } from '@/game/music/chords'
import type { ScaleShape } from '@/game/music/scales'
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
  /** Note du parcours de gamme (voir `ScaleRunState`). */
  scale?: boolean
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
  /** Multiplicateur appliqué : 2 pendant un combo ou sur une note de triade jouée à temps, sinon 1. */
  multiplier: number
  /** Points marqués : `basePoints × multiplier`. */
  points: number
  /** Cette réponse a déclenché le combo (elle-même n'est pas multipliée). */
  comboTriggered: boolean
  /** Réponse à une note du coup de pouce (jamais multipliée, sans effet sur le combo). */
  assisted: boolean
  /**
   * Réponse à une note de bonus (`triad`, `scale`) : elle ne nourrit ni le combo
   * ni le coup de pouce. Une note de triade est doublée si elle arrive avant la
   * fin de son anneau ; celles du parcours de gamme, jamais multipliées, ne
   * comptent pas non plus pour la progression.
   */
  bonus?: 'triad' | 'scale'
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

/**
 * Triade prête à être jouée, avec la forme de gamme qu'elle ouvrira si elle est
 * réussie (`null` : aucune forme ne tient sur le manche).
 */
export interface TriadPlan extends TriadVoicing {
  scale: { shape: ScaleShape; accents: readonly number[] } | null
}

/** Triade en cours : ses trois notes sont demandées l'une après l'autre. */
export interface TriadState extends TriadPlan {
  /** Notes déjà trouvées quand la triade s'est ouverte : sa place dans la partie. */
  slot: number
  /** Index de la note demandée (0 : fondamentale, 1 : tierce, 2 : quinte). */
  step: number
  /** Toutes les réponses jusqu'ici justes, et chacune assez rapide. */
  clean: boolean
  /** Réponses fausses jusqu'ici. */
  missed: number
  /** Temps de réaction le plus long jusqu'ici (ms). */
  slowestMs: number
}

/** Issue de la dernière triade. */
export interface TriadOutcome {
  /** Identifiant de sa dernière note (sert de clé à l'annonce). */
  id: number
  root: PitchClass
  quality: TriadQuality
  /** Notes déjà trouvées quand la triade s'est ouverte (voir `TriadState.slot`). */
  slot: number
  /** Trois bonnes réponses, chacune en moins de `TRIAD_RULES.fastReactionMs`. */
  success: boolean
  /** Raison de l'échec : une erreur au moins, ou une réponse trop lente. */
  reason?: 'wrong' | 'slow'
  /** Réponses fausses. */
  missed: number
  /** Temps de réaction le plus long des trois notes (ms). */
  slowestMs: number
  /** Gamme dont le parcours s'ouvre à la suite (triade réussie et forme disponible). */
  scale?: ScaleShape['kind']
}

/** Parcours de gamme en cours : la forme est jouée note après note, jusqu'au bout. */
export interface ScaleRunState extends ScaleShape {
  /** Index, dans `notes`, des notes de la triade d'origine (mises en valeur). */
  accents: readonly number[]
  /** Index de la note demandée. */
  step: number
  /** Issue de chaque note déjà jouée, dans l'ordre. */
  outcomes: readonly ('hit' | 'miss')[]
  /** Points gagnés jusqu'ici. */
  points: number
}

/** Issue du dernier parcours de gamme. */
export interface ScaleRunOutcome {
  /** Identifiant de sa dernière note (sert de clé à l'annonce). */
  id: number
  root: PitchClass
  quality: TriadQuality
  kind: ScaleShape['kind']
  /** Notes justes, sur le total. */
  hits: number
  total: number
  /** Points du parcours, supplément compris. */
  points: number
  perfect: boolean
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
  /** Place de chaque triade de la partie : notes trouvées à son ouverture. */
  triadSlots: readonly number[]
  /** Notes ordinaires à jouer encore avant qu'une triade puisse recommencer. */
  triadCooldown: number
  /** Issue de la dernière triade, ou `null`. */
  lastTriad: TriadOutcome | null
  /** Parcours de gamme en cours, ou `null`. */
  scaleRun: ScaleRunState | null
  /** Issue du dernier parcours de gamme, ou `null`. */
  lastScaleRun: ScaleRunOutcome | null
  /** Début de la pause en cours (`performance.now()`), ou `null` : le temps court. */
  pausedAt: number | null
  /** Temps de pause cumulé depuis le lancement (ms), hors pause en cours. */
  pausedMs: number
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
  | { type: 'next'; challenge: Challenge; now: number; triad?: TriadPlan }
  | { type: 'timeUp'; now: number }
  | { type: 'comboExpire'; now: number }
