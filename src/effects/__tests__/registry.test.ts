import { afterEach, describe, expect, it } from 'vitest'

import { listEffects, pickEffect, registerEffect, unregisterEffect } from '@/effects/registry'
import type { RevealEffect } from '@/effects/types'

const fake = (id: string, outcomes: RevealEffect['outcomes']): RevealEffect => ({
  id,
  name: id,
  outcomes,
  Component: () => null,
})

describe("registre d'effets", () => {
  afterEach(() => listEffects().forEach((e) => unregisterEffect(e.id)))

  it('filtre par issue', () => {
    registerEffect(fake('a', ['correct']))
    registerEffect(fake('b', ['wrong']))
    registerEffect(fake('c', ['correct', 'wrong']))
    expect(listEffects('correct').map((e) => e.id)).toEqual(['a', 'c'])
    expect(listEffects('wrong').map((e) => e.id)).toEqual(['b', 'c'])
  })

  it("n'enchaîne jamais deux fois le même effet", () => {
    registerEffect(fake('a', ['correct']))
    registerEffect(fake('b', ['correct']))
    let previous: string | null = null
    for (let i = 0; i < 50; i++) {
      const picked: RevealEffect = pickEffect('correct', Math.random, previous)!
      expect(picked.id).not.toBe(previous)
      previous = picked.id
    }
  })

  it('rejoue le seul effet disponible', () => {
    registerEffect(fake('solo', ['wrong']))
    expect(pickEffect('wrong', Math.random, 'solo')?.id).toBe('solo')
    expect(pickEffect('correct', Math.random)).toBeNull()
  })
})
