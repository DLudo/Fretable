import { describe, expect, it } from 'vitest'

import { BOSS_RULES } from '@/game/config'
import {
  bossReducer,
  createBossChart,
  createBossState,
  ghostY,
  laneFor,
  nextMissAt,
  type BossNote,
  type BossState,
} from '@/game/boss'
import { createNeckLayout } from '@/game/fretboard/geometry'
import { getLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { pitchClassAt, STANDARD_TUNING } from '@/game/music/tuning'

const level = getLevel(0)
const { windows, life } = BOSS_RULES

/** Partition d'essai : une note toutes les 4 s, La puis Do puis Mi… */
const chart = (pcs: PitchClass[]): BossNote[] =>
  pcs.map((pc, i) => ({ id: i + 1, stringIndex: 0, fret: 5, pc, hitAt: 5000 + i * 4000 }))

const started = (pcs: PitchClass[] = [9, 0, 4]): BossState =>
  bossReducer(createBossState(), { type: 'start', now: 0, notes: chart(pcs) })

describe('partition du boss', () => {
  it('tire des notes au hasard, à intervalle régulier, jamais deux fois la même d’affilée', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const notes = createBossChart(level, STANDARD_TUNING, random, 1000)
    expect(notes).toHaveLength(BOSS_RULES.noteCount)
    notes.forEach((note, i) => {
      expect(note.hitAt).toBe(1000 + BOSS_RULES.firstHitMs + i * BOSS_RULES.intervalMs)
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
    // La bonne touche, juste après, ne rattrape rien : elle vise la note suivante, encore loin.
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
    s = bossReducer(s, { type: 'press', pc: 0, at: 9000 + 80 })
    expect(s.life).toBe(life.start - life.miss + life.heal.great)
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

describe('couloirs', () => {
  const layout = createNeckLayout({ tuning: STANDARD_TUNING })

  it('partent sous le bord bas du manche et montent jusqu’à la cible', () => {
    for (const note of [
      { stringIndex: 0, fret: 1 },
      { stringIndex: 5, fret: 12 },
    ]) {
      const { target, launch } = laneFor(layout, note)
      expect(launch.x).toBe(target.x)
      expect(launch.y).toBeCloseTo(layout.halfWidthAt(target.x) + BOSS_RULES.launchMm, 6)
      expect(launch.y).toBeGreaterThan(target.y)
    }
  })

  it('font monter le fantôme à vitesse constante, pile sur la cible à l’instant voulu', () => {
    const target = { x: 100, y: -10 }
    expect(ghostY(target, 5000, 5000)).toBe(-10)
    expect(ghostY(target, 5000, 4000)).toBeCloseTo(-10 + BOSS_RULES.ghostSpeedMmPerSec, 6)
    // Au-delà de l'instant voulu, il continue de monter.
    expect(ghostY(target, 5000, 5500)).toBeLessThan(-10)
  })
})
