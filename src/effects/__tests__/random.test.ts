import { describe, expect, it } from 'vitest'

import { range, seededRandom } from '@/lib/random'

describe('seededRandom', () => {
  it('rejoue la même suite pour une même graine', () => {
    const a = seededRandom(1234)
    const b = seededRandom(1234)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })

  it('diffère d’une graine à l’autre', () => {
    const a = seededRandom(1)
    const b = seededRandom(2)
    const draws = Array.from({ length: 5 }, () => [a(), b()])
    expect(draws.some(([x, y]) => x !== y)).toBe(true)
  })

  it('reste dans [0, 1) avec une moyenne ≈ 0,5', () => {
    const random = seededRandom(0xdeadbeef)
    let sum = 0
    const n = 20_000
    for (let i = 0; i < n; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      sum += value
    }
    expect(sum / n).toBeGreaterThan(0.48)
    expect(sum / n).toBeLessThan(0.52)
  })

  it('range borne ses valeurs dans [min, max)', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 200; i++) {
      const value = range(random, -2, 3)
      expect(value).toBeGreaterThanOrEqual(-2)
      expect(value).toBeLessThan(3)
    }
  })
})
