import { BOSS_RULES } from '@/game/config'
import { bossMultiplier } from './combo'
import type { BossAction, BossJudged, BossJudgement, BossNote, BossState } from './types'

export type BossRules = typeof BOSS_RULES

export function createBossState(rules: BossRules = BOSS_RULES): BossState {
  return {
    phase: 'ready',
    notes: [],
    hits: [],
    cursor: 0,
    life: rules.life.start,
    bossLife: rules.bossLife,
    score: 0,
    combo: 0,
    bestCombo: 0,
    startedAt: null,
    endedAt: null,
    lastHit: null,
    lastIgnored: null,
  }
}

/** Précision d'une bonne frappe, selon son écart à l'instant parfait. */
export function gradeHit(deltaMs: number, rules: BossRules = BOSS_RULES): BossJudgement {
  const gap = Math.abs(deltaMs)
  if (gap <= rules.windows.perfectMs) return 'perfect'
  if (gap <= rules.windows.greatMs) return 'great'
  return 'good'
}

/**
 * Fenêtre de jugement d'une note (ms avant et après l'instant parfait) : plus
 * large pour une note bonus, plus rapide que les autres (`BOSS_RULES.bonus`).
 */
export function windowOf(
  note: Pick<BossNote, 'bonus'>,
  rules: BossRules = BOSS_RULES,
): { earlyMs: number; lateMs: number } {
  return note.bonus
    ? { earlyMs: rules.bonus.earlyMs, lateMs: rules.bonus.lateMs }
    : { earlyMs: rules.windows.earlyMs, lateMs: rules.windows.lateMs }
}

/** Fin de la fenêtre de la prochaine note à juger : passé cet instant, elle est manquée. */
export function nextMissAt(state: BossState, rules: BossRules = BOSS_RULES): number | null {
  if (state.phase !== 'playing') return null
  const note = state.notes[state.cursor]
  return note ? note.hitAt + windowOf(note, rules).lateMs : null
}

/**
 * Moteur du boss : réducteur pur, piloté par l'horloge (`tick`) et les frappes
 * (`press`), à instants injectés. Une note se juge une seule fois : la première
 * frappe dans sa fenêtre décide (une mauvaise touche est une erreur, sauf sur
 * une note bonus, qui se retente), une frappe trop tôt ne compte pas, et une
 * fenêtre close sans frappe vaut un raté. Une frappe sans effet est notée
 * (`lastIgnored`) pour en montrer la raison. Les
 * notes se jouent dans l'ordre d'arrivée : une frappe vise toujours la première
 * note pas encore jugée, même si les suivantes sont déjà en vol. Seules les
 * réussites blessent le boss : il tombe à la `bossLife`-ième, et les échecs
 * ne font qu'allonger le combat, au prix de la vie du joueur. Les notes bonus
 * (`BossNote.bonus`) se jouent à leur tour, comme les autres, mais ne comptent
 * que pour le score. Le combo
 * (voir `bossComboTier`) multiplie les points des réussites qui suivent une
 * série, et retombe à la première erreur ou au premier raté.
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
      // Trop tôt : la frappe ne compte pas (un retour le signale sur la note).
      if (deltaMs < -windowOf(note, rules).earlyMs) return ignore(swept, action.at, 'early')
      // Note bonus : une mauvaise touche ne la consomme pas, on peut retenter.
      if (note.bonus && action.pc !== note.pc) return ignore(swept, action.at, 'wrong')
      const judgement = action.pc === note.pc ? gradeHit(deltaMs, rules) : 'wrong'
      return resolve(swept, { judgement, at: action.at, deltaMs, guess: action.pc }, rules)
    }
  }
}

/** Frappe sans effet sur le jugement de la note à jouer : seul son retour est noté. */
function ignore(state: BossState, at: number, reason: 'early' | 'wrong'): BossState {
  return { ...state, lastIgnored: { at, index: state.cursor, reason } }
}

/** Juge « raté » chaque note dont la fenêtre s'est close avant `at`. */
function sweep(state: BossState, at: number, rules: BossRules): BossState {
  let next = state
  while (next.phase === 'playing') {
    const note = next.notes[next.cursor]
    if (!note) break
    const closesAt = note.hitAt + windowOf(note, rules).lateMs
    if (at <= closesAt) break
    next = resolve(next, { judgement: 'miss', at: closesAt, deltaMs: null, guess: null }, rules)
  }
  return next
}

/** Applique le jugement de la note en cours : vie, score, combo, fin de partie. */
function resolve(state: BossState, judged: BossJudged, rules: BossRules): BossState {
  const index = state.cursor
  const { judgement } = judged
  const success = judgement === 'perfect' || judgement === 'great' || judgement === 'good'
  // Note bonus : des points (multipliés) si elle est frappée, et rien d'autre.
  // Ni vie, ni boss, ni combo : la manquer ou se tromper ne coûte rien.
  const bonus = state.notes[index]?.bonus === true
  const change = bonus
    ? 0
    : success
      ? rules.life.heal[judgement]
      : judgement === 'wrong'
        ? -rules.life.wrong
        : -rules.life.miss
  const life = Math.min(rules.life.max, Math.max(0, state.life + change))
  // La série d'avant cette note fixe son multiplicateur ; un échec rompt le combo.
  const multiplier = !success
    ? 1
    : bonus
      ? rules.bonus.multiplier
      : bossMultiplier(state.combo, rules)
  const points = success ? rules.points[judgement] * multiplier : 0
  const hit = { ...judged, multiplier, points }
  const combo = bonus ? state.combo : success ? state.combo + 1 : 0
  const hits = state.hits.slice()
  hits[index] = hit
  const cursor = index + 1
  const bossLife = success && !bonus ? Math.max(0, state.bossLife - 1) : state.bossLife
  const won = life > 0 && bossLife <= 0
  // K.O., ou partition épuisée sans que le boss tombe (garde-fou : la partition
  // est taillée pour que le combat se termine avant, voir `bossChartLength`).
  const lost = !won && (life <= 0 || cursor >= state.notes.length)
  return {
    ...state,
    phase: lost ? 'lost' : won ? 'won' : 'playing',
    endedAt: lost || won ? hit.at : null,
    hits,
    cursor,
    life,
    bossLife,
    score: state.score + points,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    lastHit: { ...hit, index },
  }
}
