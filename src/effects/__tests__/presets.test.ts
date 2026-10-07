import { describe, expect, it } from 'vitest'

import { isRevealEffect, PRESET_EFFECTS } from '@/effects/presets'
import type { RevealOutcome } from '@/effects/types'

const OUTCOMES: readonly RevealOutcome[] = ['correct', 'wrong']

describe('presets', () => {
  it('ont des identifiants uniques, en kebab-case, et un nom', () => {
    const ids = PRESET_EFFECTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const effect of PRESET_EFFECTS) {
      expect(effect.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(effect.name.length).toBeGreaterThan(0)
    }
  })

  it('offrent au moins deux effets par issue (sinon un effet se répète)', () => {
    for (const outcome of OUTCOMES) {
      expect(PRESET_EFFECTS.filter((e) => e.outcomes.includes(outcome)).length).toBeGreaterThan(1)
    }
  })

  it('déclarent des issues, poids et durées valides', () => {
    for (const effect of PRESET_EFFECTS) {
      expect(effect.outcomes.length).toBeGreaterThan(0)
      effect.outcomes.forEach((o) => expect(OUTCOMES).toContain(o))
      if (effect.weight !== undefined) expect(effect.weight).toBeGreaterThan(0)
      if (effect.maxDurationMs !== undefined) expect(effect.maxDurationMs).toBeGreaterThan(0)
    }
  })

  it("reconnaît un descripteur d'effet et rien d'autre", () => {
    expect(PRESET_EFFECTS.every(isRevealEffect)).toBe(true)
    expect(isRevealEffect(null)).toBe(false)
    expect(isRevealEffect({ id: 'x', outcomes: ['correct'] })).toBe(false)
    expect(isRevealEffect(() => null)).toBe(false)
  })
})
