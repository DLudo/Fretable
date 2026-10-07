import { describe, expect, it } from 'vitest'

import { createChallenge } from '@/game/engine/challenge'
import { createInitialState, gameReducer } from '@/game/engine/reducer'
import type { Challenge, GameState } from '@/game/engine/types'
import { getLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { STANDARD_TUNING } from '@/game/music/tuning'

const challenge = (id: number, pc: PitchClass): Challenge => ({ id, stringIndex: 0, fret: 1, pc })

function play(state: GameState, pc: PitchClass, now: number, next?: Challenge): GameState {
  const guessed = gameReducer(state, { type: 'guess', pc, now })
  return next ? gameReducer(guessed, { type: 'next', challenge: next }) : guessed
}

describe('niveau 1', () => {
  it('demande 6 notes en 30 secondes', () => {
    expect(getLevel(0)).toMatchObject({ targetCount: 6, durationMs: 30_000 })
  })
})

describe('moteur de jeu', () => {
  const started = gameReducer(createInitialState(0), {
    type: 'start',
    now: 1000,
    challenge: challenge(1, 5),
  })

  it('démarre en état de jeu', () => {
    expect(started).toMatchObject({ phase: 'playing', locked: false, startedAt: 1000 })
  })

  it('verrouille la saisie pendant la révélation', () => {
    const s = play(started, 5, 2000)
    expect(s.locked).toBe(true)
    expect(play(s, 5, 2100)).toBe(s)
  })

  it('compte les bonnes réponses et la série', () => {
    let s = play(started, 5, 2000, challenge(2, 7))
    s = play(s, 7, 3000, challenge(3, 9))
    expect(s).toMatchObject({ correctCount: 2, streak: 2, mistakes: 0 })
    s = play(s, 0, 4000, challenge(4, 0))
    expect(s).toMatchObject({ correctCount: 2, streak: 0, mistakes: 1, bestStreak: 2 })
    expect(s.lastResult).toMatchObject({ correct: false, guess: 0, challenge: { pc: 9 } })
  })

  it('gagne à la sixième bonne réponse et fige le temps', () => {
    let s = started
    for (let i = 0; i < 6; i++) {
      const current = s.challenge!
      s = play(s, current.pc, 2000 + i * 1000, i < 5 ? challenge(10 + i, 3) : undefined)
    }
    expect(s).toMatchObject({ phase: 'won', correctCount: 6, endedAt: 7000 })
    expect(gameReducer(s, { type: 'timeUp', now: 31_000 })).toBe(s)
  })

  it("perd quand le temps s'écoule", () => {
    const s = gameReducer(started, { type: 'timeUp', now: 31_000 })
    expect(s).toMatchObject({ phase: 'lost', locked: true })
    expect(play(s, 5, 31_100)).toBe(s)
  })

  it('refuse une réponse arrivée après l’échéance', () => {
    const s = play(started, 5, 31_001)
    expect(s.phase).toBe('lost')
    expect(s.correctCount).toBe(0)
  })

  it('ignore « next » hors révélation', () => {
    expect(gameReducer(started, { type: 'next', challenge: challenge(9, 1) })).toBe(started)
  })

  it('repart à zéro au redémarrage', () => {
    const s = play(started, 5, 2000)
    const restarted = gameReducer(s, { type: 'start', now: 5000, challenge: challenge(20, 2) })
    expect(restarted).toMatchObject({ phase: 'playing', correctCount: 0, streak: 0, results: [] })
  })
})

describe('tirage des notes', () => {
  it('ne repropose jamais la même note deux fois de suite', () => {
    const level = getLevel(0)
    let previous: Challenge | null = null
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 500; i++) {
      const c: Challenge = createChallenge(i, level, STANDARD_TUNING, random, previous)
      expect(c.fret).toBeGreaterThanOrEqual(1)
      expect(c.fret).toBeLessThanOrEqual(12)
      if (previous) expect(c.pc).not.toBe(previous.pc)
      previous = c
    }
  })
})
