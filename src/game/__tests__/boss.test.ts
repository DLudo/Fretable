import { describe, expect, it } from 'vitest'

import { BOSS_RULES, COMBO_RULES } from '@/game/config'
import {
  rateBossFight,
  bossChartLength,
  bossComboTier,
  bossMultiplier,
  bossReducer,
  createBossChart,
  createBossState,
  ghostProgress,
  lerpPoint,
  missCheckDelay,
  nextMissAt,
  targetOpacity,
  visibleBossNotes,
  type BossNote,
  type BossState,
} from '@/game/boss'
import { getLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { pitchClassAt, STANDARD_TUNING } from '@/game/music/tuning'

const level = getLevel(0)
const { windows, life } = BOSS_RULES

/** Partition d'essai : arrivées toutes les 4 s dès 5 s (trajet 4 s), La puis Do puis Mi… */
const chart = (pcs: PitchClass[]): BossNote[] =>
  pcs.map((pc, i) => ({
    id: i + 1,
    stringIndex: 0,
    fret: 5,
    pc,
    launchAt: 1000 + i * 4000,
    hitAt: 5000 + i * 4000,
  }))

const started = (pcs: PitchClass[] = [9, 0, 4]): BossState =>
  bossReducer(createBossState(), { type: 'start', now: 0, notes: chart(pcs) })

describe('partition du boss', () => {
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const notes = createBossChart(level, STANDARD_TUNING, random, 1000)
  const regular = notes.filter((note) => !note.bonus)
  const bonuses = notes.filter((note) => note.bonus)

  it('tire des notes au hasard, jamais deux fois la même d’affilée, à intervalle régulier', () => {
    expect(regular).toHaveLength(bossChartLength())
    regular.forEach((note, i) => {
      expect(note.launchAt).toBe(1000 + BOSS_RULES.startDelayMs + i * BOSS_RULES.intervalMs)
      expect(note.hitAt).toBe(note.launchAt + BOSS_RULES.travelMs)
    })
    notes.forEach((note, i) => {
      expect(note.pc).toBe(pitchClassAt(STANDARD_TUNING, note.stringIndex, note.fret))
      expect(note.fret).toBeGreaterThanOrEqual(level.frets.min)
      expect(note.fret).toBeLessThanOrEqual(level.frets.max)
      if (i > 0) expect(note.pc).not.toBe(notes[i - 1].pc)
    })
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length)
    // Deux notes du boss de suite diffèrent aussi, note bonus intercalée ou non.
    regular.slice(1).forEach((note, i) => expect(note.pc).not.toBe(regular[i].pc))
  })

  it('intercale des notes bonus, plus rapides, à mi-chemin de deux notes', () => {
    expect(bonuses.length).toBeGreaterThan(0)
    // Rangées dans l'ordre d'arrivée.
    notes.slice(1).forEach((note, i) => expect(note.hitAt).toBeGreaterThan(notes[i].hitAt))
    for (const bonus of bonuses) {
      const index = notes.indexOf(bonus)
      const [before, after] = [notes[index - 1], notes[index + 1]]
      expect(before.bonus).toBeUndefined()
      expect(after.bonus).toBeUndefined()
      expect(bonus.hitAt).toBe(before.hitAt + BOSS_RULES.intervalMs / 2)
      expect(bonus.hitAt - bonus.launchAt).toBe(BOSS_RULES.bonus.travelMs)
      expect(BOSS_RULES.bonus.travelMs).toBeLessThan(BOSS_RULES.travelMs)
    }
    // Leurs fenêtres de jugement, plus larges, ne chevauchent pas celles des notes voisines.
    const { earlyMs, lateMs } = BOSS_RULES.bonus
    expect(BOSS_RULES.intervalMs / 2).toBeGreaterThan(windows.lateMs + earlyMs)
    expect(BOSS_RULES.intervalMs / 2).toBeGreaterThan(lateMs + windows.earlyMs)
    // Jamais après la dernière note.
    expect(notes.at(-1)!.bonus).toBeUndefined()
  })

  it('n’intercale rien sans chance de bonus, et partout avec une chance pleine', () => {
    const chart = (chance: number) =>
      createBossChart(level, STANDARD_TUNING, random, 0, {
        ...BOSS_RULES,
        bonus: { ...BOSS_RULES.bonus, chance },
      })
    expect(chart(0).some((n) => n.bonus)).toBe(false)
    const full = chart(1)
    expect(full.filter((n) => n.bonus)).toHaveLength(bossChartLength() - 1)
    // Un bonus entre chaque paire : les notes du boss restent distinctes de la précédente.
    const regular = full.filter((n) => !n.bonus)
    regular.slice(1).forEach((note, i) => expect(note.pc).not.toBe(regular[i].pc))
  })
})

describe('notes bonus', () => {
  /** Note La, puis une note bonus Do à mi-chemin (7 s), puis Mi. */
  const withBonus = (): BossState => {
    const notes = chart([9, 4])
    const bonus: BossNote = {
      id: 99,
      stringIndex: 1,
      fret: 3,
      pc: 0,
      launchAt: 4500,
      hitAt: 7000,
      bonus: true,
    }
    return bossReducer(createBossState(), {
      type: 'start',
      now: 0,
      notes: [notes[0], bonus, { ...notes[1], hitAt: 9000 }],
    })
  }

  it('triple les points d’une note bonus frappée, sans toucher vie, boss ni combo', () => {
    // Vie entamée : une recharge indue se verrait.
    let s = bossReducer({ ...withBonus(), life: 50 }, { type: 'press', pc: 9, at: 5000 })
    const before = { life: s.life, bossLife: s.bossLife, combo: s.combo, bestCombo: s.bestCombo }
    s = bossReducer(s, { type: 'press', pc: 0, at: 7000 + 80 })
    expect(s.lastHit).toMatchObject({
      judgement: 'great',
      multiplier: BOSS_RULES.bonus.multiplier,
      points: 600 * BOSS_RULES.bonus.multiplier,
    })
    expect(s).toMatchObject({ ...before, cursor: 2, score: 1000 + 1800 })
  })

  it('ne coûte rien, manquée, et le combo continue', () => {
    const played = bossReducer(withBonus(), { type: 'press', pc: 9, at: 5000 })
    const missed = bossReducer(played, { type: 'tick', at: 7000 + BOSS_RULES.bonus.lateMs + 1 })
    expect(missed).toMatchObject({ life: played.life, combo: 1, score: 1000, cursor: 2 })
    expect(missed.lastHit).toMatchObject({ judgement: 'miss', multiplier: 1, points: 0, index: 1 })
    // La note suivante se joue normalement, série comprise.
    expect(bossReducer(missed, { type: 'press', pc: 4, at: 9000 })).toMatchObject({ combo: 2 })
  })

  it('ne se consomme pas sur une mauvaise touche : on peut retenter', () => {
    const played = bossReducer(withBonus(), { type: 'press', pc: 9, at: 5000 })
    const wrong = bossReducer(played, { type: 'press', pc: 2, at: 7000 })
    // Rien n'est jugé : la note bonus reste à jouer, l'erreur est seulement signalée.
    expect(wrong).toEqual({ ...played, lastIgnored: { at: 7000, index: 1, reason: 'wrong' } })
    const retried = bossReducer(wrong, { type: 'press', pc: 0, at: 7100 })
    expect(retried.lastHit).toMatchObject({ judgement: 'great', index: 1, points: 1800 })
  })

  it('ne se retente qu’une fois : la deuxième mauvaise touche la juge, sans rien coûter', () => {
    const played = bossReducer(withBonus(), { type: 'press', pc: 9, at: 5000 })
    const once = bossReducer(played, { type: 'press', pc: 2, at: 7000 })
    const twice = bossReducer(once, { type: 'press', pc: 5, at: 7050 })
    expect(twice).toMatchObject({ cursor: 2, life: played.life, combo: 1, score: 1000 })
    expect(twice.lastHit).toMatchObject({ judgement: 'wrong', guess: 5, points: 0, index: 1 })
    // La bonne touche, trop tard, ne la rattrape plus : elle vise la note suivante.
    expect(bossReducer(twice, { type: 'press', pc: 0, at: 7100 }).hits).toBe(twice.hits)
  })

  it('ne se gagne pas en balayant le clavier', () => {
    const played = bossReducer(withBonus(), { type: 'press', pc: 9, at: 5000 })
    // Toutes les touches, de 60 en 60 ms dès l'ouverture de la fenêtre, la bonne en dernier.
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0] as PitchClass[]
    const rolled = keys.reduce(
      (s, pc, i) => bossReducer(s, { type: 'press', pc, at: 6700 + i * 60 }),
      played,
    )
    expect(rolled.hits[1]).toMatchObject({ judgement: 'wrong', points: 0 })
    expect(rolled.score).toBe(1000)
  })

  it('se juge plus large que les autres : plus rapide, elle tolère plus d’avance et de retard', () => {
    const played = bossReducer(withBonus(), { type: 'press', pc: 9, at: 5000 })
    const { earlyMs, lateMs } = BOSS_RULES.bonus
    expect(earlyMs).toBeGreaterThan(windows.earlyMs)
    expect(lateMs).toBeGreaterThan(windows.lateMs)
    // 300 ms d'avance : ignorée pour une note ordinaire, comptée pour une note bonus.
    expect(bossReducer(played, { type: 'press', pc: 0, at: 7000 - 300 }).lastHit).toMatchObject({
      judgement: 'good',
      index: 1,
    })
    expect(bossReducer(played, { type: 'press', pc: 0, at: 7000 - earlyMs - 1 })).toMatchObject({
      cursor: 1,
      lastIgnored: { reason: 'early', index: 1 },
    })
    // Pas encore manquée 300 ms après sa cible, manquée passé sa fenêtre.
    expect(nextMissAt(played)).toBe(7000 + lateMs)
    expect(bossReducer(played, { type: 'tick', at: 7000 + lateMs })).toBe(played)
    expect(bossReducer(played, { type: 'tick', at: 7000 + lateMs + 1 }).hits[1]).toMatchObject({
      judgement: 'miss',
      at: 7000 + lateMs,
    })
  })

  it('ne vise que sa fenêtre : une frappe pour la note suivante attend son tour', () => {
    const played = bossReducer(withBonus(), { type: 'press', pc: 9, at: 5000 })
    // Trop tôt pour la note bonus : rien n'est jugé, la frappe est seulement signalée.
    expect(bossReducer(played, { type: 'press', pc: 0, at: 6000 })).toEqual({
      ...played,
      lastIgnored: { at: 6000, index: 1, reason: 'early' },
    })
    // Bonus laissé filer, la frappe suivante vise la note d'après.
    const s = bossReducer(played, { type: 'press', pc: 4, at: 9000 })
    expect(s.hits[1]).toMatchObject({ judgement: 'miss' })
    expect(s.hits[2]).toMatchObject({ judgement: 'perfect' })
  })
})

describe('jugement', () => {
  it('ne juge rien sur une frappe trop tôt, même fausse, mais la signale', () => {
    const s = started()
    const early = (pc: PitchClass, at: number) => bossReducer(s, { type: 'press', pc, at })
    expect(early(9, 5000 - windows.earlyMs - 1)).toEqual({
      ...s,
      lastIgnored: { at: 5000 - windows.earlyMs - 1, index: 0, reason: 'early' },
    })
    expect(early(2, 3000)).toEqual({ ...s, lastIgnored: { at: 3000, index: 0, reason: 'early' } })
  })

  it('note la précision d’une bonne frappe', () => {
    const s = started()
    const at = (delta: number) =>
      bossReducer(s, { type: 'press', pc: 9, at: 5000 + delta }).lastHit?.judgement
    expect(at(0)).toBe('perfect')
    expect(at(-windows.perfectMs)).toBe('perfect')
    expect(at(80)).toBe('great')
    expect(at(-windows.earlyMs)).toBe('good')
    expect(at(windows.lateMs)).toBe('good')
  })

  it('compte une bonne frappe : points, combo, recharge plafonnée, note suivante', () => {
    const s = bossReducer(started(), { type: 'press', pc: 9, at: 5000 })
    expect(s).toMatchObject({ cursor: 1, score: 1000, combo: 1, life: life.max })
    expect(s.hits[0]).toMatchObject({ judgement: 'perfect', deltaMs: 0, guess: 9 })
  })

  it('juge une mauvaise touche comme une erreur, qui consomme la note', () => {
    const s = bossReducer(started(), { type: 'press', pc: 2, at: 5010 })
    expect(s).toMatchObject({ cursor: 1, combo: 0, score: 0, life: life.start - life.wrong })
    expect(s.lastHit).toMatchObject({ judgement: 'wrong', guess: 2, index: 0 })
    // La bonne touche, juste après, ne rattrape rien, et ne dit rien de la note
    // suivante, tout juste partie : la frappe visait encore la précédente.
    expect(bossReducer(s, { type: 'press', pc: 9, at: 5050 })).toBe(s)
  })

  it('dit « trop tard » d’une frappe qui vise une note déjà manquée, et non « trop tôt »', () => {
    const missed = bossReducer(started(), { type: 'tick', at: 5000 + windows.lateMs + 1 })
    const late = bossReducer(missed, { type: 'press', pc: 9, at: 5000 + windows.lateMs + 20 })
    expect(late).toEqual({
      ...missed,
      lastIgnored: { at: 5000 + windows.lateMs + 20, index: 0, reason: 'late' },
    })
    // Le raté se juge aussi dans la foulée de la frappe, sans tick préalable.
    expect(bossReducer(started(), { type: 'press', pc: 9, at: 5300 })).toMatchObject({
      cursor: 1,
      lastIgnored: { index: 0, reason: 'late' },
    })
    // Plus proche de la fenêtre suivante que de la précédente : trop tôt pour la note à jouer.
    const opensAt = 9000 - windows.earlyMs
    expect(bossReducer(missed, { type: 'press', pc: 0, at: opensAt - 100 })).toMatchObject({
      lastIgnored: { index: 1, reason: 'early' },
    })
  })

  it('juge un raté à la fermeture de la fenêtre, moins coûteux qu’une erreur', () => {
    const s = started()
    expect(bossReducer(s, { type: 'tick', at: 5000 + windows.lateMs })).toBe(s)
    const missed = bossReducer(s, { type: 'tick', at: 5000 + windows.lateMs + 1 })
    expect(missed).toMatchObject({ cursor: 1, life: life.start - life.miss })
    expect(missed.hits[0]).toMatchObject({ judgement: 'miss', guess: null, deltaMs: null })
    expect(life.miss).toBeLessThan(life.wrong)
  })

  it('rattrape les ratés en retard avant de juger une frappe', () => {
    const s = bossReducer(started(), { type: 'press', pc: 0, at: 9000 })
    expect(s.hits[0]).toMatchObject({ judgement: 'miss', at: 5000 + windows.lateMs })
    expect(s.hits[1]).toMatchObject({ judgement: 'perfect' })
    expect(s.cursor).toBe(2)
  })

  it('recharge la vie à chaque réussite', () => {
    let s = bossReducer(started(), { type: 'tick', at: 6000 })
    expect(s.life).toBe(life.start - life.miss)
    s = bossReducer(s, { type: 'press', pc: 0, at: s.notes[1].hitAt + 80 })
    expect(s.life).toBe(life.start - life.miss + life.heal.great)
  })
})

describe('combo', () => {
  const { triggerCount, multiplier, fireCount, fireMultiplier } = BOSS_RULES.combo
  /** Partition de 30 La, dont les `n` premières notes sont jouées selon `play` : justes, fausses ou manquées. */
  const played = (n: number, play: (i: number) => 'hit' | 'wrong' | 'miss' = () => 'hit') => {
    let s = started(Array.from({ length: 30 }, () => 9 as PitchClass))
    for (let i = 0; i < n; i++) {
      const hitAt = 5000 + i * 4000
      const how = play(i)
      if (how === 'hit') s = bossReducer(s, { type: 'press', pc: 9, at: hitAt })
      else if (how === 'wrong') s = bossReducer(s, { type: 'press', pc: 2, at: hitAt })
      else s = bossReducer(s, { type: 'tick', at: hitAt + windows.lateMs + 1 })
    }
    return s
  }

  it('s’allume en bleu après 5 réussites, puis s’enflamme après 10', () => {
    expect([0, 4, 5, 9, 10, 25].map((n) => bossComboTier(n))).toEqual([
      null,
      null,
      'combo',
      'combo',
      'fire',
      'fire',
    ])
    expect([4, 5, 9, 10].map((n) => bossMultiplier(n))).toEqual([1, 2, 2, 3])
    expect(multiplier).toBe(COMBO_RULES.multiplier)
    expect([triggerCount, fireCount, fireMultiplier]).toEqual([5, 10, 3])
  })

  it('double les notes après la 5e réussite et triple après la 10e, sans les précédentes', () => {
    const s = played(12)
    expect(s.hits.slice(0, 12).map((h) => h?.multiplier)).toEqual([
      1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3,
    ])
    expect(s.hits[5]).toMatchObject({ points: 2000, multiplier: 2 })
    expect(s.hits[10]).toMatchObject({ points: 3000, multiplier: 3 })
    expect(s.score).toBe(5 * 1000 + 5 * 2000 + 2 * 3000)
    expect(s).toMatchObject({ combo: 12, bestCombo: 12 })
  })

  it('multiplie chaque précision, pas seulement les frappes parfaites', () => {
    let s = played(5)
    s = bossReducer(s, { type: 'press', pc: 9, at: 5000 + 5 * 4000 + 80 })
    expect(s.lastHit).toMatchObject({ judgement: 'great', multiplier: 2, points: 1200 })
  })

  it('s’éteint à la première erreur ou au premier raté, et il faut tout recommencer', () => {
    for (const fail of ['wrong', 'miss'] as const) {
      const s = played(18, (i) => (i === 11 ? fail : 'hit'))
      expect(s.hits[11]).toMatchObject({ judgement: fail, multiplier: 1, points: 0 })
      // Après l'échec, cinq réussites sans bonus avant que le combo ne revienne.
      expect(s.hits.slice(12, 18).map((h) => h?.multiplier)).toEqual([1, 1, 1, 1, 1, 2])
      expect(s).toMatchObject({ combo: 6, bestCombo: 11 })
    }
  })

  it('n’a pas de jauge : seul un échec l’éteint, le temps ne fait rien', () => {
    // Six notes à la file, puis une septième qui n'arrive que près d'une minute plus tard.
    const notes = chart(Array.from({ length: 7 }, () => 9 as PitchClass))
    notes[6] = { ...notes[6], launchAt: 80_000, hitAt: 84_000 }
    let s = bossReducer(createBossState(), { type: 'start', now: 0, notes })
    for (let i = 0; i < 6; i++) s = bossReducer(s, { type: 'press', pc: 9, at: notes[i].hitAt })
    // Une minute sans rien à jouer : le combo tient toujours.
    const later = bossReducer(s, { type: 'tick', at: 83_000 })
    expect(later.combo).toBe(6)
    expect(bossComboTier(later.combo)).toBe('combo')
    expect(bossReducer(later, { type: 'press', pc: 9, at: 84_000 }).lastHit).toMatchObject({
      multiplier: 2,
      points: 2000,
    })
  })
})

describe('calendrier', () => {
  it('ne bouge pas au fil des jugements : les notes en vol gardent leur course', () => {
    const before = started()
    const late = bossReducer(before, { type: 'press', pc: 9, at: 5150 })
    const missed = bossReducer(before, { type: 'tick', at: 5300 })
    expect(late.notes).toBe(before.notes)
    expect(missed.notes).toBe(before.notes)
    expect(nextMissAt(late)).toBe(9000 + windows.lateMs)
  })

  it('vise toujours la première note pas encore jugée, même avec d’autres en vol', () => {
    // La deuxième (Do) est déjà en route : une frappe de Do pendant la fenêtre
    // de la première (La) est une erreur sur la première.
    const s = bossReducer(started(), { type: 'press', pc: 0, at: 5000 })
    expect(s.hits[0]).toMatchObject({ judgement: 'wrong', guess: 0 })
    expect(s.cursor).toBe(1)
  })
})

describe('fin du combat', () => {
  it('est vaincu à la réussite qui épuise sa vie, même avec des notes encore en vol', () => {
    let s: BossState = { ...started([9, 0, 4]), bossLife: 2 }
    s = bossReducer(s, { type: 'press', pc: 9, at: 5000 })
    expect(s).toMatchObject({ phase: 'playing', bossLife: 1 })
    s = bossReducer(s, { type: 'press', pc: 0, at: 9000 })
    expect(s).toMatchObject({ phase: 'won', endedAt: 9000, cursor: 2, bossLife: 0 })
    expect(nextMissAt(s)).toBeNull()
    // Plus rien ne bouge ensuite.
    expect(bossReducer(s, { type: 'press', pc: 4, at: 13_000 })).toBe(s)
  })

  it('n’est pas blessé par une erreur ni par un raté : le combat se prolonge', () => {
    let s: BossState = { ...started([9, 0, 4, 9]), bossLife: 2 }
    s = bossReducer(s, { type: 'press', pc: 2, at: 5000 })
    s = bossReducer(s, { type: 'tick', at: 9000 + windows.lateMs + 1 })
    expect(s).toMatchObject({ phase: 'playing', cursor: 2, bossLife: 2 })
    s = bossReducer(s, { type: 'press', pc: 4, at: 13_000 })
    s = bossReducer(s, { type: 'press', pc: 9, at: 17_000 })
    expect(s).toMatchObject({ phase: 'won', cursor: 4, bossLife: 0 })
  })

  it('met le joueur K.O. quand sa vie tombe à zéro', () => {
    const errors = Math.ceil(life.start / life.wrong)
    let s = started(Array.from({ length: errors + 5 }, (_, i) => (i % 2 ? 0 : 9) as PitchClass))
    for (let i = 0; i < errors; i++) {
      s = bossReducer(s, { type: 'press', pc: 11, at: 5000 + i * 4000 })
    }
    expect(s).toMatchObject({
      phase: 'lost',
      life: 0,
      cursor: errors,
      bossLife: BOSS_RULES.bossLife,
    })
    expect(s.endedAt).toBe(5000 + (errors - 1) * 4000)
  })

  it('perd si la partition s’épuise avant le boss (garde-fou)', () => {
    let s = started([9, 0])
    s = bossReducer(s, { type: 'press', pc: 9, at: 5000 })
    s = bossReducer(s, { type: 'press', pc: 0, at: 9000 })
    expect(s).toMatchObject({ phase: 'lost', life: life.max, bossLife: BOSS_RULES.bossLife - 2 })
  })

  it('taille la partition pour que le combat finisse toujours avant elle', () => {
    const { start, miss, wrong, heal } = life
    expect(bossChartLength()).toBe(62)
    // Pire cas : chaque réussite rend le plus de vie possible, chaque échec en coûte le moins.
    const failures = Math.ceil(
      (start + BOSS_RULES.bossLife * Math.max(heal.perfect, heal.great, heal.good)) /
        Math.min(miss, wrong),
    )
    expect(bossChartLength()).toBe(BOSS_RULES.bossLife + failures)
    // Pire cas joué : un raté, une réussite, et ainsi de suite (la vie ne bute jamais sur son
    // plafond) jusqu'à 29 réussites, puis plus que des ratés : K.O. à la 61e note sur 62.
    let s = started(Array.from({ length: bossChartLength() }, () => 9 as PitchClass))
    let landed = 0
    for (let i = 0; s.phase === 'playing'; i++) {
      const hitAt = 5000 + i * 4000
      if (i % 2 === 1 && landed < BOSS_RULES.bossLife - 1) {
        s = bossReducer(s, { type: 'press', pc: 9, at: hitAt })
        landed++
      } else s = bossReducer(s, { type: 'tick', at: hitAt + windows.lateMs + 1 })
    }
    expect(s).toMatchObject({ phase: 'lost', life: 0, cursor: 61, bossLife: 1 })
    expect(s.cursor).toBeLessThan(bossChartLength())
  })
})

describe('minuterie des ratés', () => {
  it('revérifie tant que la fenêtre n’est pas réellement close', () => {
    expect(missCheckDelay(5220, 1000)).toBe(4221)
    // Réveil un rien trop tôt, ou pile à la limite : on attend encore.
    expect(missCheckDelay(5220, 5219.6)).toBe(2)
    expect(missCheckDelay(5220, 5220)).toBe(1)
    // Fenêtre close : le raté se juge tout de suite.
    expect(missCheckDelay(5220, 5220.001)).toBeNull()
  })
})

describe('notes affichées', () => {
  it('montre toutes les notes en vol, la plus avancée étant celle à jouer', () => {
    const s = started()
    const at = (now: number, state = s) =>
      visibleBossNotes(state, now).map(({ note, hit, current }) => [
        note.id,
        hit?.judgement ?? null,
        current,
      ])
    expect(at(900)).toEqual([])
    expect(at(3000)).toEqual([[1, null, true]])
    // La deuxième est partie (5 000) avant que la première n'arrive : deux en vol.
    expect(at(5100)).toEqual([
      [1, null, true],
      [2, null, false],
    ])
    // La première jugée, la deuxième devient celle à jouer ; la première reste
    // le temps de ses retours, puis disparaît.
    const hit = bossReducer(s, { type: 'press', pc: 9, at: 5150 })
    expect(at(5200, hit)).toEqual([
      [1, 'good', false],
      [2, null, true],
    ])
    expect(at(5150 + BOSS_RULES.fadeMs + 1, hit)).toEqual([[2, null, true]])
  })

  it('range les notes en vol dans la file : 0 pour celle à jouer, puis 1, 2…', () => {
    const s = started([9, 0, 4, 5])
    const ranks = (state: BossState, now: number) =>
      visibleBossNotes(state, now).map(({ note, rank }) => [note.id, rank])
    // À 9 100, trois notes sont parties (1 000, 5 000, 9 000).
    expect(ranks(s, 9100)).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ])
    // La première jugée, chacune monte d'un cran ; la jugée n'a plus de rang.
    const hit = bossReducer(s, { type: 'press', pc: 9, at: 5000 })
    expect(ranks(hit, 9100)).toEqual([
      [2, 0],
      [3, 1],
    ])
  })

  it('donne aux anneaux d’arrivée une opacité dégressive selon leur rang', () => {
    expect([0, 1, 2, 3, 6].map(targetOpacity)).toEqual([1, 0.5, 0.25, 0.25, 0.25])
    // Une note jugée garde son anneau plein le temps de ses retours.
    expect(targetOpacity(-1)).toBe(1)
  })

  it('n’affiche plus aucune note en vol une fois le combat fini', () => {
    let s = started([9, 0])
    s = bossReducer(s, { type: 'press', pc: 2, at: 5000 })
    const ended = { ...s, phase: 'lost' as const }
    expect(visibleBossNotes(ended, 5100).map(({ note }) => note.id)).toEqual([1])
  })
})

describe('trajet des fantômes', () => {
  it('va du bas de l’écran (0) à la cible (1) à vitesse constante, puis la dépasse', () => {
    const note = { launchAt: 1000, hitAt: 5000 }
    expect(ghostProgress(note, 1000)).toBe(0)
    expect(ghostProgress(note, 3000)).toBe(0.5)
    expect(ghostProgress(note, 5000)).toBe(1)
    expect(ghostProgress(note, 5400)).toBeCloseTo(1.1, 6)
    expect(ghostProgress(note, 500)).toBeLessThan(0)
  })

  it('dépasse la cible à l’allure demandée, sans saut', () => {
    const note = { launchAt: 1000, hitAt: 5000 }
    expect(ghostProgress(note, 3000, 8000)).toBe(0.5)
    expect(ghostProgress(note, 5000, 8000)).toBe(1)
    expect(ghostProgress(note, 5400, 8000)).toBeCloseTo(1.05, 6)
  })

  it('se place sur le segment départ → cible, et dans son prolongement', () => {
    const from = { x: 100, y: 900 }
    const to = { x: 100, y: 300 }
    expect(lerpPoint(from, to, 0)).toEqual(from)
    expect(lerpPoint(from, to, 1)).toEqual(to)
    expect(lerpPoint(from, to, 0.5)).toEqual({ x: 100, y: 600 })
    expect(lerpPoint(from, to, 1.1).y).toBeCloseTo(240, 6)
  })
})

describe('étoiles du boss', () => {
  const max = life.max
  const stars = (remaining: number, phase: BossState['phase'] = 'won') =>
    rateBossFight({ phase, life: remaining }).stars

  it('donne trois étoiles au-delà des deux tiers de vie, deux dès un tiers, une en deçà', () => {
    expect(stars(max)).toBe(3)
    expect(stars(67)).toBe(3)
    expect(stars(66.5)).toBe(2)
    expect(stars(33.5)).toBe(2)
    expect(stars(33)).toBe(1)
    expect(stars(0.5)).toBe(1)
  })

  it('tranche les seuils exacts : pile aux deux tiers, deux étoiles ; pile au tiers, deux', () => {
    // Vie maximale de 90 : tiers exacts (30 et 60).
    const rules = { life: { max: 90 }, rating: BOSS_RULES.rating }
    const at = (remaining: number) => rateBossFight({ phase: 'won', life: remaining }, rules).stars
    expect([at(60.5), at(60), at(30), at(29.5)]).toEqual([3, 2, 2, 1])
  })

  it('n’en donne aucune sur une défaite', () => {
    expect(stars(max, 'lost')).toBe(0)
    expect(stars(max, 'playing')).toBe(0)
    expect(rateBossFight({ phase: 'lost', life: 0 })).toEqual({ stars: 0, index: 0 })
  })

  it('note la vie exacte quand le boss tombe, soin du dernier coup compris', () => {
    // 29 parfaits (vie plafonnée à 100), 4 erreurs (64), puis un « Super » (+2,5) : 66,5.
    let s: BossState = {
      ...started(Array.from({ length: 34 }, () => 9 as PitchClass)),
      bossLife: 30,
    }
    for (let i = 0; i < 34; i++) {
      const at = 5000 + i * 4000
      s = bossReducer(s, {
        type: 'press',
        pc: i >= 29 && i < 33 ? 2 : 9,
        at: i === 33 ? at + 80 : at,
      })
    }
    expect(s).toMatchObject({ phase: 'won', life: 66.5 })
    // 66,5 n'est pas plus des deux tiers de 100 : deux étoiles (l'écran affiche « 66,5 »).
    expect(rateBossFight(s).stars).toBe(2)
  })

  it('expose la part de vie restante', () => {
    expect(rateBossFight({ phase: 'won', life: 50 }).index).toBe(0.5)
  })
})
