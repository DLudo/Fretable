import { describe, expect, it } from 'vitest'

import { COMBO_RULES } from '@/game/config'
import { createInitialState, gameReducer } from '@/game/engine/reducer'
import { basePoints, isCritical, stepCombo } from '@/game/engine/scoring'
import type { Challenge, GameState } from '@/game/engine/types'
import type { PitchClass } from '@/game/music/notes'

describe('barème des points', () => {
  it('récompense le temps de réaction', () => {
    const table: Array<[number, number]> = [
      [0, 1000],
      [500, 1000],
      [501, 600],
      [999, 600],
      [1000, 400],
      [1999, 400],
      [2000, 300],
      [2999, 300],
      [3000, 200],
      [4999, 200],
      [5000, 100],
      [9999, 100],
      [10_000, 50],
      [60_000, 50],
    ]
    for (const [ms, points] of table) expect([ms, basePoints(ms)]).toEqual([ms, points])
  })

  it('reconnaît le coup critique (0,5 s ou moins)', () => {
    expect(isCritical(500)).toBe(true)
    expect(isCritical(501)).toBe(false)
  })
})

/** Partie scriptée : chaque note apparaît à `shownAt` et reçoit sa réponse `reaction` ms plus tard. */
function scripted(
  plays: Array<{ reaction: number; correct?: boolean; gap?: number }>,
): GameState[] {
  let t = 1000
  const note = (id: number): Challenge => ({
    id,
    stringIndex: 0,
    fret: 1,
    pc: (id % 12) as PitchClass,
  })
  let s = gameReducer(createInitialState(0), { type: 'start', now: t, challenge: note(1) })
  const states: GameState[] = []
  plays.forEach(({ reaction, correct = true, gap = 400 }, i) => {
    const target = s.challenge!
    t += reaction
    const pc = (correct ? target.pc : (target.pc + 1) % 12) as PitchClass
    s = gameReducer(s, { type: 'guess', pc, now: t })
    states.push(s)
    t += gap
    s = gameReducer(s, { type: 'comboExpire', now: t })
    s = gameReducer(s, { type: 'next', challenge: note(i + 2), now: t })
  })
  return states
}

describe('combo', () => {
  it('se déclenche à la troisième bonne réponse rapide, sans la multiplier', () => {
    const [a, b, c, d] = scripted([
      { reaction: 800 },
      { reaction: 2500 },
      { reaction: 900 },
      { reaction: 900 },
    ])
    expect(a.combo).toBeNull()
    expect(b.combo).toBeNull()
    expect(c.combo).not.toBeNull()
    expect(c.lastResult).toMatchObject({ comboTriggered: true, multiplier: 1, points: 600 })
    expect(d.lastResult).toMatchObject({ comboTriggered: false, multiplier: 2, points: 1200 })
    expect(d.score).toBe(600 + 300 + 600 + 1200)
  })

  it('exige trois réponses rapides consécutives', () => {
    const lent = scripted([
      { reaction: 800 },
      { reaction: 800 },
      { reaction: 3000 },
      { reaction: 800 },
    ])
    expect(lent.every((s) => s.combo === null)).toBe(true)
    const faux = scripted([
      { reaction: 800 },
      { reaction: 800, correct: false },
      { reaction: 800 },
      { reaction: 800 },
    ])
    expect(faux.every((s) => s.combo === null)).toBe(true)
  })

  it('dure six secondes, indépendamment des erreurs', () => {
    const states = scripted([
      { reaction: 800 },
      { reaction: 800 },
      { reaction: 800 }, // déclenchement
      { reaction: 1500, correct: false },
      { reaction: 1500, correct: false },
    ])
    const trigger = states[2].combo!
    expect(trigger.endsAt - trigger.startedAt).toBe(COMBO_RULES.durationMs)
    // Les erreurs ne coupent ni ne rechargent le combo ; elles ne rapportent rien.
    expect(states[4].combo).toBe(trigger)
    expect(states[4].lastResult).toMatchObject({ multiplier: 2, points: 0 })
  })

  it('se recharge de deux secondes par réponse rapide, sans dépasser six secondes', () => {
    const combo = { startedAt: 0, endsAt: 6000 }
    // À 1 s : 5 s restantes + 2 s → plafonné à 6 s.
    expect(stepCombo(combo, 0, { now: 1000, correct: true, reactionMs: 800 }).combo).toEqual({
      startedAt: 0,
      endsAt: 7000,
    })
    // À 4 s : 2 s restantes + 2 s = 4 s.
    expect(stepCombo(combo, 0, { now: 4000, correct: true, reactionMs: 800 }).combo).toEqual({
      startedAt: 0,
      endsAt: 8000,
    })
    // Réponse lente : pas de recharge, mais toujours ×2.
    const slow = stepCombo(combo, 0, { now: 4000, correct: true, reactionMs: 3500 })
    expect(slow.combo).toBe(combo)
    expect(slow.multiplier).toBe(2)
  })

  it('s’éteint à échéance ; il faut alors trois nouvelles réponses rapides', () => {
    // Dans une partie : la jauge se vide pendant une longue réflexion.
    const states = scripted([
      { reaction: 800 },
      { reaction: 800 },
      { reaction: 800 }, // déclenchement
      { reaction: 7000 },
    ])
    expect(states[3].combo).toBeNull()
    expect(states[3].lastResult).toMatchObject({ multiplier: 1, points: 100 })
    expect(states[3].fastStreak).toBe(0)

    // Au-delà des six notes du niveau 1 : la règle elle-même, réponse par réponse.
    const expired = { startedAt: 0, endsAt: 6000 }
    const fast = (now: number) => ({ now, correct: true, reactionMs: 800 })
    const first = stepCombo(expired, 0, fast(6500))
    expect(first).toMatchObject({ combo: null, fastStreak: 1, multiplier: 1, triggered: false })
    const second = stepCombo(first.combo, first.fastStreak, fast(7500))
    expect(second).toMatchObject({ combo: null, fastStreak: 2 })
    const third = stepCombo(second.combo, second.fastStreak, fast(8500))
    expect(third).toMatchObject({ fastStreak: 0, multiplier: 1, triggered: true })
    expect(third.combo).toEqual({ startedAt: 8500, endsAt: 8500 + COMBO_RULES.durationMs })
  })

  it('ignore une expiration prématurée et s’éteint à la victoire comme à la défaite', () => {
    const live = scripted([{ reaction: 800 }, { reaction: 800 }, { reaction: 800 }])[2]
    expect(gameReducer(live, { type: 'comboExpire', now: live.combo!.endsAt - 1 })).toBe(live)
    expect(gameReducer(live, { type: 'timeUp', now: 31_000 }).combo).toBeNull()
    const won = scripted(Array.from({ length: 6 }, () => ({ reaction: 800 })))[5]
    expect(won.phase).toBe('won')
    expect(won.combo).toBeNull()
  })
})
