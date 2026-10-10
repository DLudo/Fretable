import { describe, expect, it } from 'vitest'

import { BOSS_RULES } from '@/game/config'
import {
  bossReducer,
  createBossChart,
  createBossState,
  ghostProgress,
  lerpPoint,
  missCheckDelay,
  nextMissAt,
  visibleBossNotes,
  type BossNote,
  type BossState,
} from '@/game/boss'
import { getLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { pitchClassAt, STANDARD_TUNING } from '@/game/music/tuning'

const level = getLevel(0)
const { windows, life } = BOSS_RULES

/** Partition d'essai : arrivées provisoires toutes les 4 s dès 5 s, La puis Do puis Mi… */
const chart = (pcs: PitchClass[]): BossNote[] =>
  pcs.map((pc, i) => ({
    id: i + 1,
    stringIndex: 0,
    fret: 5,
    pc,
    launchAt: 1000 + i * BOSS_RULES.travelMs,
    hitAt: 1000 + (i + 1) * BOSS_RULES.travelMs,
  }))

const started = (pcs: PitchClass[] = [9, 0, 4]): BossState =>
  bossReducer(createBossState(), { type: 'start', now: 0, notes: chart(pcs) })

describe('partition du boss', () => {
  it('tire des notes au hasard, jamais deux fois la même d’affilée, à instants provisoires', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const notes = createBossChart(level, STANDARD_TUNING, random, 1000)
    expect(notes).toHaveLength(BOSS_RULES.noteCount)
    notes.forEach((note, i) => {
      expect(note.launchAt).toBe(1000 + BOSS_RULES.startDelayMs + i * BOSS_RULES.travelMs)
      expect(note.hitAt).toBe(note.launchAt + BOSS_RULES.travelMs)
      expect(note.pc).toBe(pitchClassAt(STANDARD_TUNING, note.stringIndex, note.fret))
      expect(note.fret).toBeGreaterThanOrEqual(level.frets.min)
      expect(note.fret).toBeLessThanOrEqual(level.frets.max)
      if (i > 0) expect(note.pc).not.toBe(notes[i - 1].pc)
    })
  })
})

describe('jugement', () => {
  it('ne fait rien sur une frappe trop tôt, même fausse', () => {
    const s = started()
    expect(bossReducer(s, { type: 'press', pc: 9, at: 5000 - windows.earlyMs - 1 })).toBe(s)
    expect(bossReducer(s, { type: 'press', pc: 2, at: 3000 })).toBe(s)
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
    // La bonne touche, juste après, ne rattrape rien : elle vise la note suivante, tout juste partie.
    expect(bossReducer(s, { type: 'press', pc: 9, at: 5050 })).toBe(s)
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
    // La première note, manquée, est jugée à la fermeture de sa fenêtre ; la
    // suivante est partie à cet instant et arrive 4 s plus tard.
    const missedAt = 5000 + windows.lateMs
    const s = bossReducer(started(), { type: 'press', pc: 0, at: missedAt + BOSS_RULES.travelMs })
    expect(s.hits[0]).toMatchObject({ judgement: 'miss', at: missedAt })
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

describe('enchaînement', () => {
  it('fait partir la note suivante à l’instant même du jugement', () => {
    // Frappe un peu en avance : la suivante part aussitôt, sans attendre l'heure prévue.
    const hit = bossReducer(started(), { type: 'press', pc: 9, at: 4950 })
    expect(hit.notes[1]).toMatchObject({ launchAt: 4950, hitAt: 4950 + BOSS_RULES.travelMs })
    // Les notes d'après gardent leur espacement provisoire.
    expect(hit.notes[2].launchAt).toBe(4950 + BOSS_RULES.travelMs)
    expect(nextMissAt(hit)).toBe(4950 + BOSS_RULES.travelMs + windows.lateMs)
    // Une erreur aussi, et un raté à la fermeture de sa fenêtre.
    const wrong = bossReducer(started(), { type: 'press', pc: 2, at: 5100 })
    expect(wrong.notes[1].launchAt).toBe(5100)
    const missed = bossReducer(started(), { type: 'tick', at: 5300 })
    expect(missed.notes[1].launchAt).toBe(5000 + windows.lateMs)
  })

  it('ne touche pas aux notes déjà jugées', () => {
    const before = started()
    const s = bossReducer(before, { type: 'press', pc: 9, at: 4950 })
    expect(s.notes[0]).toBe(before.notes[0])
    expect(s.notes[0]).toMatchObject({ launchAt: 1000, hitAt: 5000 })
  })
})

describe('fin du combat', () => {
  it('est vaincu quand la dernière note est jouée, vie restante', () => {
    let s = started([9, 0])
    s = bossReducer(s, { type: 'press', pc: 9, at: 5000 })
    expect(nextMissAt(s)).toBe(9000 + windows.lateMs)
    s = bossReducer(s, { type: 'tick', at: 20_000 })
    expect(s).toMatchObject({ phase: 'won', endedAt: 9000 + windows.lateMs, cursor: 2 })
    expect(nextMissAt(s)).toBeNull()
    // Plus rien ne bouge ensuite.
    expect(bossReducer(s, { type: 'press', pc: 0, at: 20_100 })).toBe(s)
  })

  it('met le joueur K.O. quand sa vie tombe à zéro', () => {
    const errors = Math.ceil(life.start / life.wrong)
    let s = started(Array.from({ length: errors + 5 }, (_, i) => (i % 2 ? 0 : 9) as PitchClass))
    for (let i = 0; i < errors; i++) {
      s = bossReducer(s, { type: 'press', pc: 11, at: 5000 + i * 4000 })
    }
    expect(s).toMatchObject({ phase: 'lost', life: 0, cursor: errors })
    expect(s.endedAt).toBe(5000 + (errors - 1) * 4000)
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
  it('une seule en vol : la suivante attend le jugement, même après son départ provisoire', () => {
    const s = started()
    // Avant le départ de la première, rien ; ensuite, elle seule.
    expect(visibleBossNotes(s, 900)).toEqual([])
    expect(visibleBossNotes(s, 3000).map(({ note }) => note.id)).toEqual([1])
    // Fenêtre de retard de la première : le départ provisoire de la suivante
    // (5 000) est passé, mais elle n'est pas dessinée.
    expect(visibleBossNotes(s, 5100).map(({ note }) => note.id)).toEqual([1])
    // Jugée en retard, la première laisse place à la suivante, partie à cet instant.
    const late = bossReducer(s, { type: 'press', pc: 9, at: 5150 })
    expect(visibleBossNotes(late, 5160).map(({ note, hit }) => [note.id, hit?.judgement])).toEqual([
      [1, 'good'],
      [2, undefined],
    ])
    expect(late.notes[1].launchAt).toBe(5150)
    // Ses retours passés, la note jugée disparaît.
    expect(visibleBossNotes(late, 5150 + BOSS_RULES.fadeMs + 1).map(({ note }) => note.id)).toEqual(
      [2],
    )
  })

  it('n’affiche plus aucune note en attente une fois le combat fini', () => {
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

  it('se place sur le segment départ → cible, et dans son prolongement', () => {
    const from = { x: 100, y: 900 }
    const to = { x: 100, y: 300 }
    expect(lerpPoint(from, to, 0)).toEqual(from)
    expect(lerpPoint(from, to, 1)).toEqual(to)
    expect(lerpPoint(from, to, 0.5)).toEqual({ x: 100, y: 600 })
    expect(lerpPoint(from, to, 1.1).y).toBeCloseTo(240, 6)
  })
})
