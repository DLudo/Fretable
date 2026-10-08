import { describe, expect, it } from 'vitest'

import { ASSIST_RULES } from '@/game/config'
import { averageReactionMs, shouldOfferAssist } from '@/game/engine/assist'
import { createAssistChallenge } from '@/game/engine/challenge'
import { createInitialState, gameReducer } from '@/game/engine/reducer'
import type { Challenge, GameState, GuessResult } from '@/game/engine/types'
import { getLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { pitchClassAt, STANDARD_TUNING } from '@/game/music/tuning'

const answer = (reactionMs: number | null): GuessResult => ({
  id: 1,
  challenge: { id: 1, stringIndex: 0, fret: 1, pc: 5 },
  guess: reactionMs === null ? null : 5,
  correct: reactionMs !== null,
  streak: 0,
  at: 0,
  reactionMs,
  basePoints: 0,
  multiplier: 1,
  points: 0,
  comboTriggered: false,
  assisted: false,
})

describe('condition du coup de pouce', () => {
  it('mesure la moyenne des réponses données', () => {
    expect(averageReactionMs([])).toBeNull()
    expect(averageReactionMs([answer(4000), answer(8000), answer(null)])).toBe(6000)
  })

  it('exige assez de réponses, une moyenne au-dessus de 5 s et un tirage favorable', () => {
    const slow = [answer(6000), answer(7000)]
    expect(shouldOfferAssist([answer(9000)], 0)).toBe(false)
    expect(shouldOfferAssist(slow, 0.29)).toBe(true)
    expect(shouldOfferAssist(slow, ASSIST_RULES.chance)).toBe(false)
    expect(shouldOfferAssist([answer(5000), answer(5000)], 0)).toBe(false)
  })
})

describe('note du coup de pouce', () => {
  const level = getLevel(0)
  const previous: Challenge = { id: 1, stringIndex: 0, fret: 3, pc: 7 }
  let seed = 11
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

  it('reprend la même note, ailleurs sur le manche', () => {
    for (let i = 0; i < 100; i++) {
      const c = createAssistChallenge(i, level, STANDARD_TUNING, random, 7, previous)
      expect(c.pc).toBe(7)
      expect(pitchClassAt(STANDARD_TUNING, c.stringIndex, c.fret)).toBe(7)
      expect([c.stringIndex, c.fret]).not.toEqual([0, 3])
      expect(c.assist).toBe(true)
    }
  })

  it('peut rester au même endroit sur demande', () => {
    const c = createAssistChallenge(2, level, STANDARD_TUNING, random, 7, previous, true)
    expect(c).toMatchObject({ stringIndex: 0, fret: 3, pc: 7, assist: true })
  })
})

describe('coup de pouce en partie', () => {
  const note = (id: number, pc: PitchClass, assist = false): Challenge => ({
    id,
    stringIndex: 0,
    fret: 1,
    pc,
    ...(assist ? { assist } : {}),
  })

  /** Joue `pcs` (réponses justes) avec un temps de réaction et un tirage donnés. */
  function run(
    start: GameState,
    plays: Array<{ reaction: number; roll?: number; next?: Challenge }>,
  ) {
    let s = start
    let t = s.challengeShownAt ?? 0
    for (const { reaction, roll, next } of plays) {
      t += reaction
      s = gameReducer(s, { type: 'guess', pc: s.challenge!.pc, now: t, roll })
      if (next) s = gameReducer(s, { type: 'next', challenge: next, now: t + 400 })
      t += 400
    }
    return s
  }

  const started = gameReducer(createInitialState(0), {
    type: 'start',
    now: 0,
    challenge: note(1, 2),
  })

  it('est offert après des réponses lentes, sur la note qui vient d’être révélée', () => {
    const s = run(started, [
      { reaction: 7000, roll: 0.1, next: note(2, 4) },
      { reaction: 7000, roll: 0.1 },
    ])
    expect(s.assist).toEqual({ pc: 4, total: 3, remaining: 3 })
    expect(s.assistUsed).toBe(true)
  })

  it('n’est pas offert si le tirage est défavorable ou les réponses rapides', () => {
    const unlucky = run(started, [
      { reaction: 7000, roll: 0.9, next: note(2, 4) },
      { reaction: 7000, roll: 0.9 },
    ])
    expect(unlucky.assist).toBeNull()
    const quick = run(started, [
      { reaction: 1500, roll: 0, next: note(2, 4) },
      { reaction: 1500, roll: 0 },
    ])
    expect(quick.assist).toBeNull()
  })

  it('propose trois fois la note, sans multiplicateur ni combo, puis s’arrête pour la partie', () => {
    const offered = run(started, [
      { reaction: 7000, roll: 0.1, next: note(2, 4) },
      { reaction: 7000, roll: 0.1, next: note(3, 4, true) },
    ])
    const after = run(offered, [
      { reaction: 300, roll: 0, next: note(4, 4, true) },
      { reaction: 300, roll: 0, next: note(5, 4, true) },
      { reaction: 300, roll: 0 },
    ])
    expect(after.results.slice(-3).every((r) => r.assisted && r.multiplier === 1)).toBe(true)
    expect(after.results.slice(-3).every((r) => r.points === 1000)).toBe(true)
    // Trois réponses éclair, mais pas de combo : coup de pouce et combo ne se cumulent pas.
    expect(after.combo).toBeNull()
    expect(after.fastStreak).toBe(0)
    expect(after.assist).toBeNull()
    expect(after.assistUsed).toBe(true)
  })

  it('ne revient pas une seconde fois dans la même partie', () => {
    const used: GameState = { ...started, assistUsed: true, results: [answer(9000), answer(9000)] }
    expect(run(used, [{ reaction: 9000, roll: 0 }]).assist).toBeNull()
    // Une nouvelle partie le rend de nouveau possible.
    const restarted = gameReducer(used, { type: 'start', now: 0, challenge: note(9, 2) })
    expect(restarted).toMatchObject({ assist: null, assistUsed: false })
  })

  it('éteint un combo en cours au moment où il est offert', () => {
    const withCombo: GameState = {
      ...started,
      combo: { startedAt: 0, endsAt: 100_000 },
      results: [answer(9000), answer(9000)],
    }
    const s = run(withCombo, [{ reaction: 9000, roll: 0 }])
    expect(s.assist).not.toBeNull()
    expect(s.combo).toBeNull()
  })
})
