import { ASSIST_RULES } from '@/game/config'
import { getLevel } from '@/game/levels/levels'
import { shouldOfferAssist } from './assist'
import { basePoints, stepCombo, type ComboStep } from './scoring'
import { deadlineAt } from './selectors'
import type { GameAction, GameState, GuessResult } from './types'

export function createInitialState(levelIndex = 0): GameState {
  return {
    levelIndex,
    level: getLevel(levelIndex),
    phase: 'ready',
    challenge: null,
    challengeShownAt: null,
    locked: true,
    correctCount: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
    fastStreak: 0,
    combo: null,
    assist: null,
    assistUsed: false,
    bonusTimeMs: 0,
    startingAt: null,
    startedAt: null,
    endedAt: null,
    lastResult: null,
    results: [],
  }
}

function isExpired(state: GameState, now: number): boolean {
  const deadline = deadlineAt(state)
  return deadline !== null && now >= deadline
}

/**
 * Machine à états du jeu — pure et déterministe.
 * Le hasard et l'horloge sont injectés par les actions (voir `useGame`).
 *
 *   ready ──prepare──▶ starting ──start──▶ playing ──(dernière bonne réponse)──▶ won
 *                                            │
 *                                            └──────────(timeUp)──────────────▶ lost
 *
 * `starting` est le décompte 3, 2, 1 : rien ne se joue, le temps ne court pas.
 * `load` ramène à `ready` sur un autre niveau ; `prepare` et `start` relancent
 * depuis n'importe quelle phase (`start` seul saute le décompte).
 * Le combo (voir `stepCombo`) vit à côté : déclenché par les réponses, épuisé par `comboExpire`.
 * Le coup de pouce (voir `shouldOfferAssist`) aussi : offert après une réponse,
 * il ajoute du temps et impose la même note jusqu'à `ASSIST_RULES.repeats`
 * bonnes réponses, qui ne valent ensemble qu'un cran. Combo et coup de pouce
 * ne se cumulent jamais.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return createInitialState(action.levelIndex)

    case 'prepare':
      return { ...createInitialState(state.levelIndex), phase: 'starting', startingAt: action.now }

    case 'start':
      return {
        ...createInitialState(state.levelIndex),
        phase: 'playing',
        locked: false,
        challenge: action.challenge,
        challengeShownAt: action.now,
        startedAt: action.now,
      }

    case 'guess': {
      if (state.phase !== 'playing' || state.locked || !state.challenge) return state
      // Réponse arrivée après l'échéance : refusée, comme si le minuteur avait sonné à temps.
      if (isExpired(state, action.now)) {
        return timeUp(state, deadlineAt(state)!)
      }
      const correct = action.pc === state.challenge.pc
      const streak = correct ? state.streak + 1 : 0
      const reactionMs = Math.max(0, action.now - (state.challengeShownAt ?? action.now))
      // Note du coup de pouce : ni multipliée, ni comptée pour le combo, et
      // seule la dernière bonne réponse attendue fait avancer la progression.
      const assisted = state.challenge.assist === true && state.assist !== null
      const completesAssist = assisted && correct && state.assist!.remaining <= 1
      const correctCount = state.correctCount + (correct && (!assisted || completesAssist) ? 1 : 0)
      const step: ComboStep = assisted
        ? { combo: null, fastStreak: 0, multiplier: 1, triggered: false }
        : stepCombo(state.combo, state.fastStreak, { now: action.now, correct, reactionMs })
      const base = correct ? basePoints(reactionMs) : 0
      const result: GuessResult = {
        id: state.challenge.id,
        challenge: state.challenge,
        guess: action.pc,
        correct,
        streak,
        at: action.now,
        reactionMs,
        basePoints: base,
        multiplier: step.multiplier,
        points: base * step.multiplier,
        comboTriggered: step.triggered,
        assisted,
      }
      const results = [...state.results, result]
      const won = correctCount >= state.level.targetCount

      let { combo, fastStreak } = step
      let assist = state.assist
      let assistUsed = state.assistUsed
      let bonusTimeMs = state.bonusTimeMs
      if (assisted && assist) {
        // Une erreur ne consomme rien : la note revient jusqu'à être trouvée.
        if (completesAssist) assist = null
        else if (correct) assist = { ...assist, remaining: assist.remaining - 1 }
      } else if (!won && !assistUsed && shouldOfferAssist(results, action.roll ?? 1)) {
        // Coup de pouce offert : du temps en plus, et la note qui vient d'être
        // révélée revient plusieurs fois.
        assist = {
          pc: state.challenge.pc,
          total: ASSIST_RULES.repeats,
          remaining: ASSIST_RULES.repeats,
        }
        assistUsed = true
        bonusTimeMs += ASSIST_RULES.bonusTimeMs
        combo = null
        fastStreak = 0
      }

      return {
        ...state,
        phase: won ? 'won' : 'playing',
        endedAt: won ? action.now : null,
        locked: true,
        correctCount,
        mistakes: state.mistakes + (correct ? 0 : 1),
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
        score: state.score + result.points,
        // La partie gagnée, combo et coup de pouce s'éteignent avec elle.
        combo: won ? null : combo,
        fastStreak,
        assist: won ? null : assist,
        assistUsed,
        bonusTimeMs,
        lastResult: result,
        results,
      }
    }

    case 'next':
      if (state.phase !== 'playing' || !state.locked) return state
      return {
        ...state,
        challenge: action.challenge,
        challengeShownAt: action.now,
        locked: false,
      }

    case 'timeUp':
      if (state.phase !== 'playing') return state
      return timeUp(state, action.now)

    case 'comboExpire':
      // Jauge vide : le combo s'éteint, il faudra à nouveau trois réponses rapides.
      if (!state.combo || action.now < state.combo.endsAt) return state
      return { ...state, combo: null, fastStreak: 0 }
  }
}

/**
 * Fin du temps imparti. Une note encore en attente de réponse est révélée
 * (tentative `guess: null`, non comptée comme erreur) ; si une révélation est
 * déjà en cours (`locked`), elle suffit.
 */
function timeUp(state: GameState, now: number): GameState {
  const ended: GameState = {
    ...state,
    phase: 'lost',
    locked: true,
    endedAt: now,
    combo: null,
    assist: null,
  }
  if (state.locked || !state.challenge) return ended
  const result: GuessResult = {
    id: state.challenge.id,
    challenge: state.challenge,
    guess: null,
    correct: false,
    streak: 0,
    at: now,
    reactionMs: null,
    basePoints: 0,
    multiplier: 1,
    points: 0,
    comboTriggered: false,
    assisted: state.challenge.assist === true,
  }
  return { ...ended, streak: 0, lastResult: result, results: [...state.results, result] }
}
