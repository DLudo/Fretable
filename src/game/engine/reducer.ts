import { ASSIST_RULES, SCALE_RULES, TRIAD_RULES } from '@/game/config'
import { getLevel } from '@/game/levels/levels'
import { shouldOfferAssist } from './assist'
import { basePoints, stepCombo, type ComboStep } from './scoring'
import { deadlineAt } from './selectors'
import { canStartTriad } from './triad'
import type {
  GameAction,
  GameState,
  GuessResult,
  ScaleRunState,
  TriadOutcome,
  TriadState,
} from './types'

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
    scaleRun: null,
    lastScaleRun: null,
    pausedAt: null,
    pausedMs: 0,
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
 * normalement, sans nourrir ni combo ni coup de pouce. Réussie, elle ouvre le
 * parcours de gamme (`scaleRun`) : le temps se suspend (`pausedAt`) jusqu'à sa
 * dernière note. Combo et bonus ne se cumulent jamais.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return createInitialState(action.levelIndex)

    // Le niveau porté par l'état est conservé (`load` seul en change).
    case 'prepare':
      return {
        ...createInitialState(state.levelIndex),
        level: state.level,
        phase: 'starting',
        startingAt: action.now,
      }

    case 'start':
      return {
        ...createInitialState(state.levelIndex),
        level: state.level,
        phase: 'playing',
        locked: false,
        challenge: action.challenge,
        challengeShownAt: action.now,
        startedAt: action.now,
      }

    case 'guess': {
      if (state.phase !== 'playing' || state.locked || !state.challenge) return state
      if (state.challenge.scale === true && state.scaleRun !== null) {
        return guessScaleNote(state, state.scaleRun, action.pc, action.now)
      }
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
      let { triad, lastTriad } = triadNote
        ? advanceTriad(
            state.triad!,
            { id: state.challenge.id, correct, reactionMs },
            state.lastTriad,
          )
        : { triad: state.triad, lastTriad: state.lastTriad }
      // Triade réussie : la forme de gamme qui la prolonge s'ouvre, le temps se suspend.
      let scaleRun = state.scaleRun
      let pausedAt = state.pausedAt
      const plan = triadNote ? state.triad!.scale : null
      if (!won && plan && triad === null && lastTriad?.success) {
        scaleRun = { ...plan.shape, accents: plan.accents, step: 0, outcomes: [], points: 0 }
        pausedAt = action.now
        lastTriad = { ...lastTriad, scale: plan.shape.kind }
      }
      if (assisted && assist) {
        // Une erreur ne consomme rien : la note revient jusqu'à être trouvée.
        if (completesAssist) assist = null
        else if (correct) assist = { ...assist, remaining: assist.remaining - 1 }
      } else if (
        !won &&
        !assistUsed &&
        !triadNote &&
        triad === null &&
        scaleRun === null &&
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
        scaleRun,
        pausedAt,
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
        triad: { ...action.triad, step: 0, clean: true, slot: state.correctCount },
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
    scaleRun: null,
    pausedAt: null,
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
    lastTriad: {
      id: answer.id,
      root: triad.root,
      quality: triad.quality,
      slot: triad.slot,
      success: clean,
    },
  }
}

/**
 * Réponse à une note du parcours de gamme : des points si elle est juste, rien
 * sinon, et le parcours continue jusqu'au bout. Ni progression, ni série, ni
 * erreur comptée pour la partie. À la dernière note, le supplément d'un
 * parcours sans faute s'ajoute et le temps reprend.
 */
function guessScaleNote(
  state: GameState,
  run: ScaleRunState,
  pc: GuessResult['guess'] & number,
  now: number,
): GameState {
  const challenge = state.challenge!
  const correct = pc === challenge.pc
  const points = correct ? SCALE_RULES.pointsPerNote : 0
  const result: GuessResult = {
    id: challenge.id,
    challenge,
    guess: pc,
    correct,
    streak: state.streak,
    at: now,
    reactionMs: Math.max(0, now - (state.challengeShownAt ?? now)),
    basePoints: points,
    multiplier: 1,
    points,
    comboTriggered: false,
    assisted: false,
    bonus: 'scale',
  }
  const outcomes = [...run.outcomes, correct ? ('hit' as const) : ('miss' as const)]
  const common = { locked: true, lastResult: result, results: [...state.results, result] }

  if (run.step + 1 < run.notes.length) {
    return {
      ...state,
      ...common,
      score: state.score + points,
      scaleRun: { ...run, step: run.step + 1, outcomes, points: run.points + points },
    }
  }
  const hits = outcomes.filter((o) => o === 'hit').length
  const perfect = hits === run.notes.length
  const total = run.points + points + (perfect ? SCALE_RULES.perfectBonus : 0)
  return {
    ...state,
    ...common,
    score: state.score + points + (perfect ? SCALE_RULES.perfectBonus : 0),
    scaleRun: null,
    lastScaleRun: {
      id: challenge.id,
      root: run.root,
      quality: run.quality,
      kind: run.kind,
      hits,
      total: run.notes.length,
      points: total,
      perfect,
    },
    // Fin de la pause : le temps reprend où il s'était arrêté.
    pausedMs: state.pausedMs + Math.max(0, now - (state.pausedAt ?? now)),
    pausedAt: null,
  }
}
