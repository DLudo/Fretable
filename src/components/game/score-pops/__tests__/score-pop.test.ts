import { describe, expect, it } from 'vitest'

import { SCORING } from '@/game/config'
import type { GuessResult } from '@/game/engine/types'
import { isCriticalHit, scorePopMotion, scorePopTone } from '../score-pop'

function answer(overrides: Partial<GuessResult> = {}): GuessResult {
  return {
    id: 7,
    challenge: { id: 7, stringIndex: 2, fret: 5, pc: 5 },
    guess: 5,
    correct: true,
    streak: 1,
    at: 0,
    reactionMs: 1200,
    basePoints: 400,
    multiplier: 1,
    points: 400,
    comboTriggered: false,
    assisted: false,
    ...overrides,
  }
}

describe('nombres flottants', () => {
  it('reconnaissent le coup critique au palier des 1 000 points', () => {
    expect(isCriticalHit(answer({ reactionMs: SCORING.criticalMs }))).toBe(true)
    expect(isCriticalHit(answer({ reactionMs: SCORING.criticalMs + 1 }))).toBe(false)
    expect(isCriticalHit(answer({ reactionMs: 200, correct: false }))).toBe(false)
    // Les notes du parcours de gamme se paient au même barème.
    expect(isCriticalHit(answer({ reactionMs: 200, bonus: 'scale' }))).toBe(true)
  })

  it('prennent la teinte de ce qui a multiplié les points', () => {
    expect(scorePopTone(answer())).toBe('normal')
    expect(scorePopTone(answer({ multiplier: 2 }))).toBe('combo')
    expect(scorePopTone(answer({ multiplier: 2, bonus: 'triad' }))).toBe('triad')
    expect(scorePopTone(answer({ multiplier: 3 }))).toBe('fire')
    expect(scorePopTone(answer({ bonus: 'scale' }))).toBe('scale')
    expect(scorePopTone(answer({ assisted: true }))).toBe('assist')
    // Le critique l'emporte, combo compris.
    expect(scorePopTone(answer({ reactionMs: 300, multiplier: 2 }))).toBe('crit')
  })

  it('suivent une trajectoire stable pour une même réponse, plus ample au critique', () => {
    const normal = scorePopMotion(7, 24, 'normal')
    expect(scorePopMotion(7, 24, 'normal')).toEqual(normal)
    const crit = scorePopMotion(7, 24, 'crit')
    expect(crit.fontSize).toBeGreaterThan(normal.fontSize)
    expect(crit.durationS).toBeGreaterThan(normal.durationS)
    expect(crit.tilt).not.toBe(0)
    expect(normal.tilt).toBe(0)
    expect(normal.rise).toBeGreaterThan(normal.fontSize)
  })

  it('s’écartent des deux côtés au fil des réponses', () => {
    const sides = new Set(
      Array.from({ length: 12 }, (_, id) => Math.sign(scorePopMotion(id, 24, 'normal').dx)),
    )
    expect(sides).toEqual(new Set([-1, 1]))
  })

  it('ne sortent pas de la scène : à court de hauteur, ils s’écartent davantage', () => {
    const free = scorePopMotion(3, 24, 'crit')
    const cramped = scorePopMotion(3, 24, 'crit', free.fontSize * 2)
    expect(cramped.rise).toBeLessThan(free.rise)
    expect(cramped.rise).toBeLessThanOrEqual(free.fontSize * 2 - free.fontSize * 1.5)
    expect(Math.abs(cramped.dx)).toBeGreaterThan(Math.abs(free.dx))
    expect(scorePopMotion(3, 24, 'normal', 0).rise).toBe(0)
  })

  it('gardent une taille lisible sur un petit repère', () => {
    expect(scorePopMotion(1, 6, 'scale').fontSize).toBeGreaterThanOrEqual(13)
    expect(scorePopMotion(1, 200, 'crit').fontSize).toBeLessThanOrEqual(56)
  })
})
