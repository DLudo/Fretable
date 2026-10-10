import type { PitchClass } from '@/game/music/notes'

/** Note du boss : une position du manche, son départ et l'instant où la frapper. */
export interface BossNote {
  id: number
  stringIndex: number
  fret: number
  pc: PitchClass
  /** Départ du fantôme, en bas de l'écran (`performance.now()`, ms). */
  launchAt: number
  /** Instant où le fantôme atteint la cible : `launchAt + BOSS_RULES.travelMs`. */
  hitAt: number
}

/** Jugement d'une note : réussie (selon la précision), fausse ou manquée. */
export type BossJudgement = 'perfect' | 'great' | 'good' | 'wrong' | 'miss'

/** Issue d'une note jugée. */
export interface BossHit {
  judgement: BossJudgement
  /** Instant du jugement (frappe, ou fin de la fenêtre pour un raté). */
  at: number
  /** Écart à l'instant parfait (ms, négatif = en avance) ; `null` pour un raté. */
  deltaMs: number | null
  /** Touche jouée ; `null` pour un raté. */
  guess: PitchClass | null
}

export type BossPhase = 'ready' | 'playing' | 'won' | 'lost'

export interface BossState {
  phase: BossPhase
  /** Partition : notes dans l'ordre de leur arrivée. */
  notes: readonly BossNote[]
  /** Issue de chaque note (même index que `notes`), `null` tant qu'elle n'est pas jugée. */
  hits: readonly (BossHit | null)[]
  /** Index de la première note pas encore jugée. */
  cursor: number
  /** Vie restante, de 0 à `BOSS_RULES.life.max`. */
  life: number
  score: number
  /** Réussites d'affilée. */
  combo: number
  bestCombo: number
  startedAt: number | null
  endedAt: number | null
  /** Dernière note jugée, pour les retours (piano, étiquette). */
  lastHit: (BossHit & { index: number }) | null
}

export type BossAction =
  | { type: 'start'; now: number; notes: readonly BossNote[] }
  /** Frappe d'une touche à l'instant `at`. Trop tôt (avant la fenêtre), elle ne fait rien. */
  | { type: 'press'; pc: PitchClass; at: number }
  /** Le temps passe : toute note dont la fenêtre est close sans frappe est manquée. */
  | { type: 'tick'; at: number }
