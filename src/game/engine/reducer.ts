import { ASSIST_RULES, TRIAD_RULES } from '@/game/config'
import { getLevel } from '@/game/levels/levels'
import { shouldOfferAssist } from './assist'
import { basePoints, stepCombo, type ComboStep } from './scoring'
import { deadlineAt } from './selectors'
import { canStartTriad } from './triad'
import type { GameAction, GameState, GuessResult, TriadOutcome, TriadState } from './types'

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
    triad: null,
    triadsStarted: 0,
    lastTriad: null,
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
 * bonnes réponses, qui ne valent ensemble qu'un cran. La triade (voir
 * `canStartTriad`) arrive avec une note (`next`) : ses trois notes comptent
 * normalement, sans nourrir ni combo ni coup de pouce. Combo et bonus ne se
 * cumulent jamais.
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
      // Note de la triade : comptée normalement, mais hors combo et hors coup de pouce.
      const triadNote = state.challenge.triad === true && state.triad !== null
      const correctCount = state.correctCount + (correct && (!assisted || completesAssist) ? 1 : 0)
      const step: ComboStep =
        assisted || triadNote
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
        ...(triadNote ? { bonus: 'triad' as const } : {}),
      }
      const results = [...state.results, result]
      const won = correctCount >= state.level.targetCount

      let { combo, fastStreak } = step
      let assist = state.assist
      let assistUsed = state.assistUsed
      let bonusTimeMs = state.bonusTimeMs
      const { triad, lastTriad } = triadNote
        ? advanceTriad(
            state.triad!,
            { id: state.challenge.id, correct, reactionMs },
            state.lastTriad,
          )
        : { triad: state.triad, lastTriad: state.lastTriad }
      if (assisted && assist) {
        // Une erreur ne consomme rien : la note revient jusqu'à être trouvée.
        if (completesAssist) assist = null
        else if (correct) assist = { ...assist, remaining: assist.remaining - 1 }
      } else if (
        !won &&
        !assistUsed &&
        !triadNote &&
        triad === null &&
        shouldOfferAssist(results, action.roll ?? 1)
      ) {
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
        triad: won ? null : triad,
        lastTriad,
        lastResult: result,
        results,
      }
    }

    case 'next': {
      if (state.phase !== 'playing' || !state.locked) return state
      const shown: GameState = {
        ...state,
        challenge: action.challenge,
        challengeShownAt: action.now,
        locked: false,
      }
      if (!action.triad) return shown
      if (!canStartTriad(state)) {
        // Triade refusée : la note reste, mais redevient une note ordinaire.
        const { triad: _ignored, ...plain } = action.challenge
        return { ...shown, challenge: plain }
      }
      // Triade engagée : combo éteint (un bonus ne se cumule pas avec lui).
      return {
        ...shown,
        triad: { ...action.triad, step: 0, clean: true },
        triadsStarted: state.triadsStarted + 1,
        combo: null,
        fastStreak: 0,
      }
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
    triad: null,
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
    ...(state.challenge.triad ? { bonus: 'triad' as const } : {}),
  }
  return { ...ended, streak: 0, lastResult: result, results: [...state.results, result] }
}

/**
 * Fait avancer la triade d'une réponse. Elle va toujours au bout de ses trois
 * notes ; la dernière réponse en livre l'issue : réussie si toutes trois ont été
 * justes et rapides.
 */
function advanceTriad(
  triad: TriadState,
  answer: { id: number; correct: boolean; reactionMs: number },
  lastTriad: TriadOutcome | null = null,
): { triad: TriadState | null; lastTriad: TriadOutcome | null } {
  const clean = triad.clean && answer.correct && answer.reactionMs < TRIAD_RULES.fastReactionMs
  if (triad.step + 1 < triad.notes.length) {
    return { triad: { ...triad, step: triad.step + 1, clean }, lastTriad }
  }
  return {
    triad: null,
    lastTriad: { id: answer.id, root: triad.root, quality: triad.quality, success: clean },
  }
}
