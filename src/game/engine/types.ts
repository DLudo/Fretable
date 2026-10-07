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
}

export interface GameState {
  levelIndex: number
  level: LevelConfig
  phase: GamePhase
  challenge: Challenge | null
  /** Saisie bloquée pendant la révélation. */
  locked: boolean
  correctCount: number
  mistakes: number
  streak: number
  bestStreak: number
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
  | { type: 'guess'; pc: PitchClass; now: number }
  | { type: 'next'; challenge: Challenge }
  | { type: 'timeUp'; now: number }
