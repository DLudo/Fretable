import { BOSS_RULES } from '@/game/config'
import type { BossAction, BossHit, BossJudgement, BossState } from './types'

export type BossRules = typeof BOSS_RULES

export function createBossState(rules: BossRules = BOSS_RULES): BossState {
  return {
    phase: 'ready',
    notes: [],
    hits: [],
    cursor: 0,
    life: rules.life.start,
    score: 0,
    combo: 0,
    bestCombo: 0,
    startedAt: null,
    endedAt: null,
    lastHit: null,
  }
}

/** Précision d'une bonne frappe, selon son écart à l'instant parfait. */
export function gradeHit(deltaMs: number, rules: BossRules = BOSS_RULES): BossJudgement {
  const gap = Math.abs(deltaMs)
  if (gap <= rules.windows.perfectMs) return 'perfect'
  if (gap <= rules.windows.greatMs) return 'great'
  return 'good'
}

/** Fin de la fenêtre de la prochaine note à juger : passé cet instant, elle est manquée. */
export function nextMissAt(state: BossState, rules: BossRules = BOSS_RULES): number | null {
  if (state.phase !== 'playing') return null
  const note = state.notes[state.cursor]
  return note ? note.hitAt + rules.windows.lateMs : null
}

/**
 * Moteur du boss : réducteur pur, piloté par l'horloge (`tick`) et les frappes
 * (`press`), à instants injectés. Une note se juge une seule fois : la première
 * frappe dans sa fenêtre décide (une mauvaise touche est une erreur), une frappe
 * trop tôt ne fait rien, et une fenêtre close sans frappe vaut un raté. Sitôt
 * une note jugée, la suivante part : pas de temps mort entre deux notes.
 */
export function bossReducer(
  state: BossState,
  action: BossAction,
  rules: BossRules = BOSS_RULES,
): BossState {
  switch (action.type) {
    case 'start':
      return {
        ...createBossState(rules),
        phase: 'playing',
        notes: action.notes,
        hits: action.notes.map(() => null),
        startedAt: action.now,
      }

    case 'tick':
      return sweep(state, action.at, rules)

    case 'press': {
      // Les fenêtres closes d'abord : la frappe vise la note encore jouable.
      const swept = sweep(state, action.at, rules)
      if (swept.phase !== 'playing') return swept
      const note = swept.notes[swept.cursor]
      if (!note) return swept
      const deltaMs = action.at - note.hitAt
      if (deltaMs < -rules.windows.earlyMs) return swept
      const judgement = action.pc === note.pc ? gradeHit(deltaMs, rules) : 'wrong'
      return resolve(swept, { judgement, at: action.at, deltaMs, guess: action.pc }, rules)
    }
  }
}

/** Juge « raté » chaque note dont la fenêtre s'est close avant `at`. */
function sweep(state: BossState, at: number, rules: BossRules): BossState {
  let next = state
  while (next.phase === 'playing') {
    const note = next.notes[next.cursor]
    if (!note || at <= note.hitAt + rules.windows.lateMs) break
    next = resolve(
      next,
      { judgement: 'miss', at: note.hitAt + rules.windows.lateMs, deltaMs: null, guess: null },
      rules,
    )
  }
  return next
}

/**
 * Recale les notes à venir sur l'instant `at` : la suivante part tout de suite,
 * les autres gardent leur espacement provisoire.
 */
function relaunchFrom(
  notes: BossState['notes'],
  next: number,
  at: number,
  rules: BossRules,
): BossState['notes'] {
  if (next >= notes.length) return notes
  return notes.map((note, i) => {
    if (i < next) return note
    const launchAt = at + (i - next) * rules.travelMs
    return { ...note, launchAt, hitAt: launchAt + rules.travelMs }
  })
}

/** Applique le jugement de la note en cours : vie, score, combo, fin de partie. */
function resolve(state: BossState, hit: BossHit, rules: BossRules): BossState {
  const index = state.cursor
  const { judgement } = hit
  const success = judgement === 'perfect' || judgement === 'great' || judgement === 'good'
  const change = success
    ? rules.life.heal[judgement]
    : judgement === 'wrong'
      ? -rules.life.wrong
      : -rules.life.miss
  const life = Math.min(rules.life.max, Math.max(0, state.life + change))
  const combo = success ? state.combo + 1 : 0
  const hits = state.hits.slice()
  hits[index] = hit
  const cursor = index + 1
  const lost = life <= 0
  const won = !lost && cursor >= state.notes.length
  return {
    ...state,
    phase: lost ? 'lost' : won ? 'won' : 'playing',
    endedAt: lost || won ? hit.at : null,
    // La note suivante part à l'instant du jugement.
    notes: lost || won ? state.notes : relaunchFrom(state.notes, cursor, hit.at, rules),
    hits,
    cursor,
    life,
    score: state.score + (success ? rules.points[judgement] : 0),
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    lastHit: { ...hit, index },
  }
}
