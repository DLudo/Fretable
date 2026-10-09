import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  listEffects,
  pickEffect,
  registerEffect,
  replaceEffects,
  unregisterEffect,
} from '@/effects/registry'
import type { RevealEffect, RevealOutcome } from '@/effects/types'
import { seededRandom } from '@/lib/random'

const fake = (id: string, outcomes: RevealEffect['outcomes'], weight?: number): RevealEffect => ({
  id,
  name: id,
  outcomes,
  weight,
  Component: () => null,
})

describe("registre d'effets", () => {
  afterEach(() => {
    listEffects().forEach((e) => unregisterEffect(e.id))
    vi.restoreAllMocks()
  })

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
      const picked: RevealEffect = pickEffect('correct', Math.random, [previous])!
      expect(picked.id).not.toBe(previous)
      previous = picked.id
    }
  })

  it('rejoue le seul effet disponible', () => {
    registerEffect(fake('solo', ['wrong']))
    expect(pickEffect('wrong', Math.random, ['solo'])?.id).toBe('solo')
    expect(pickEffect('correct', Math.random)).toBeNull()
  })

  it('exclut toute la liste quand il reste un candidat', () => {
    registerEffects3()
    const random = seededRandom(1)
    for (let i = 0; i < 30; i++) expect(pickEffect('correct', random, ['a', 'b'])?.id).toBe('c')
  })

  it('lève les exclusions de moindre priorité quand le tirage serait vide', () => {
    registerEffect(fake('a', ['correct']))
    registerEffect(fake('b', ['correct']))
    const random = seededRandom(2)
    // Tout exclure viderait le tirage : seule la première exclusion (« a ») est gardée.
    for (let i = 0; i < 30; i++) expect(pickEffect('correct', random, ['a', 'b'])?.id).toBe('b')
    expect(pickEffect('correct', random, [null, undefined, 'a'])?.id).toBe('b')
  })

  it("un effet à deux issues n'est jamais rejoué juste après, même d'une issue à l'autre", () => {
    registerEffect(fake('both', ['correct', 'wrong'], 3))
    registerEffect(fake('c1', ['correct']))
    registerEffect(fake('c2', ['correct']))
    registerEffect(fake('w1', ['wrong']))
    const random = seededRandom(3)
    const recent: { last: string | null } & Record<RevealOutcome, string | null> = {
      last: null,
      correct: null,
      wrong: null,
    }
    const outcomes: RevealOutcome[] = []
    for (let i = 0; i < 400; i++) outcomes.push(random() < 0.5 ? 'correct' : 'wrong')
    for (const outcome of outcomes) {
      const picked = pickEffect(outcome, random, [recent.last, recent[outcome]])!
      expect(picked.id).not.toBe(recent.last)
      recent.last = picked.id
      recent[outcome] = picked.id
    }
  })

  it('consomme exactement un tirage', () => {
    registerEffect(fake('a', ['correct']))
    registerEffect(fake('b', ['correct']))
    const random = vi.fn(() => 0.5)
    pickEffect('correct', random, ['a'])
    expect(random).toHaveBeenCalledTimes(1)
    pickEffect('wrong', random)
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('respecte les poids', () => {
    registerEffect(fake('lourd', ['correct'], 3))
    registerEffect(fake('léger', ['correct'], 1))
    const random = seededRandom(4)
    let heavy = 0
    const draws = 8000
    for (let i = 0; i < draws; i++) if (pickEffect('correct', random)?.id === 'lourd') heavy++
    expect(heavy / draws).toBeGreaterThan(0.72)
    expect(heavy / draws).toBeLessThan(0.78)
  })

  it('signale en développement un identifiant en double ou un effet sans issue', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = fake('double', ['correct'])
    registerEffect(first)
    registerEffect(first)
    expect(warn).not.toHaveBeenCalled()
    registerEffect(fake('double', ['wrong']))
    expect(warn).toHaveBeenCalledTimes(1)
    registerEffect(fake('muet', []))
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('replaceEffects purge les effets absents de la nouvelle liste', () => {
    registerEffect(fake('ancien', ['correct']))
    replaceEffects([fake('nouveau', ['correct'])])
    expect(listEffects().map((e) => e.id)).toEqual(['nouveau'])
  })
})

function registerEffects3() {
  registerEffect(fake('a', ['correct']))
  registerEffect(fake('b', ['correct']))
  registerEffect(fake('c', ['correct']))
}
