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
  it('tire des notes au hasard, jamais deux fois la même d’affilée, à intervalle régulier', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const notes = createBossChart(level, STANDARD_TUNING, random, 1000)
    expect(notes).toHaveLength(BOSS_RULES.noteCount)
    notes.forEach((note, i) => {
      expect(note.launchAt).toBe(1000 + BOSS_RULES.startDelayMs + i * BOSS_RULES.intervalMs)
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

  it('se place sur le segment départ → cible, et dans son prolongement', () => {
    const from = { x: 100, y: 900 }
    const to = { x: 100, y: 300 }
    expect(lerpPoint(from, to, 0)).toEqual(from)
    expect(lerpPoint(from, to, 1)).toEqual(to)
    expect(lerpPoint(from, to, 0.5)).toEqual({ x: 100, y: 600 })
    expect(lerpPoint(from, to, 1.1).y).toBeCloseTo(240, 6)
  })
})
