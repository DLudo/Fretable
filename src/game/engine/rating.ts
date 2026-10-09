import { GAME_FEEL, RATING_RULES, type RatingRules } from '@/game/config'
import type { LevelConfig } from '@/game/levels/levels'
import { basePoints, stepCombo, type ComboStep } from './scoring'
import type { GameState, GuessResult } from './types'

export type StarCount = 0 | 1 | 2 | 3

/** Note de fin de partie et ce qui l'a produite (utile pour régler `RATING_RULES`). */
export interface GameRating {
  /** 0 sur une défaite, de 1 à 3 sur une victoire. */
  stars: StarCount
  /** Indice de performance dans [0, 1] (voir `RATING_RULES`). */
  index: number
  /** Score retenu : le coup de pouce n'y compte que pour une note. */
  retainedScore: number
  /** Score qui vaut la note maximale côté score (allure étalon). */
  referenceScore: number
  /** Part du temps du niveau restante à la fin, hors temps accordé, dans [0, 1]. */
  remainingShare: number
  /** Composantes de l'indice, chacune dans [0, 1]. */
  scoreRatio: number
  timeRatio: number
}

/** Réglages de notation d'un niveau : ceux de `RATING_RULES`, surchargés par le niveau. */
export function ratingRulesFor(level: LevelConfig): RatingRules {
  return { ...RATING_RULES, ...level.rating }
}

/**
 * Score d'un joueur qui trouverait toutes les notes du niveau à `paceMs` par
 * note, sans erreur ni coup de pouce : mêmes règles de points et de combo que
 * le moteur, mêmes temps de révélation entre deux notes.
 */
export function referenceScore(level: LevelConfig, paceMs: number): number {
  let step: Pick<ComboStep, 'combo' | 'fastStreak'> = { combo: null, fastStreak: 0 }
  let now = 0
  let score = 0
  for (let i = 0; i < level.targetCount; i++) {
    now += paceMs
    const next = stepCombo(step.combo, step.fastStreak, {
      now,
      correct: true,
      reactionMs: paceMs,
    })
    score += basePoints(paceMs) * next.multiplier
    step = next
    now += GAME_FEEL.holdAfterCorrectMs
  }
  return score
}

/**
 * Score retenu : les bonnes réponses du coup de pouce valent ensemble la
 * moyenne de leurs points ; le parcours de gamme, simple bonus, ne compte pas.
 */
export function retainedScore(results: readonly GuessResult[]): number {
  let own = 0
  let assistedPoints = 0
  let assistedHits = 0
  for (const r of results) {
    if (r.bonus === 'scale') continue
    if (!r.assisted) own += r.points
    else if (r.correct) {
      assistedPoints += r.points
      assistedHits++
    }
  }
  return own + (assistedHits > 0 ? assistedPoints / assistedHits : 0)
}

/**
 * Part du temps du niveau restante à la fin de la partie, sans le temps accordé
 * et sans les pauses (parcours de gamme).
 */
export function remainingShare(
  state: Pick<GameState, 'level' | 'startedAt' | 'endedAt'> & Partial<Pick<GameState, 'pausedMs'>>,
): number {
  const { level, startedAt, endedAt, pausedMs = 0 } = state
  if (startedAt === null || endedAt === null || level.durationMs <= 0) return 0
  return clamp01((level.durationMs - (endedAt - startedAt - pausedMs)) / level.durationMs)
}

/**
 * Note de la partie terminée. Une victoire vaut au moins une étoile ; deux et
 * trois étoiles demandent un indice suffisant. Une défaite n'en vaut aucune.
 */
export function rateGame(
  state: Pick<GameState, 'phase' | 'level' | 'startedAt' | 'endedAt' | 'results' | 'assistUsed'> &
    Partial<Pick<GameState, 'pausedMs'>>,
  rules: RatingRules = ratingRulesFor(state.level),
): GameRating {
  const retained = retainedScore(state.results)
  const reference = referenceScore(state.level, rules.referencePaceMs)
  const share = remainingShare(state)
  const scoreRatio = reference > 0 ? Math.min(1, retained / reference) : 1
  const timeRatio = rules.referenceTimeShare > 0 ? Math.min(1, share / rules.referenceTimeShare) : 1
  const weight = clamp01(rules.scoreWeight)
  // Arrondi : une partie pile sur un seuil (0,85 tout rond) ne perd pas d'étoile
  // à cause d'un 0,8499999999999999 de virgule flottante.
  const index = Math.round((weight * scoreRatio + (1 - weight) * timeRatio) * 1e9) / 1e9

  let stars: StarCount = 0
  if (state.phase === 'won') {
    stars = index >= rules.threeStarsAt ? 3 : index >= rules.twoStarsAt ? 2 : 1
    if (state.assistUsed)
      stars = Math.max(1, Math.min(stars, rules.maxStarsWithAssist)) as StarCount
  }

  return {
    stars,
    index,
    retainedScore: retained,
    referenceScore: reference,
    remainingShare: share,
    scoreRatio,
    timeRatio,
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
