import { describe, expect, it } from 'vitest'

import { formatSeconds } from '@/components/game/hud/format'

/** « 27,6 s » → 276 dixièmes. */
const tenthsOf = (label: string) =>
  Math.round(Number(label.replace(' s', '').replace(',', '.')) * 10)

describe('formatSeconds', () => {
  it('affiche des secondes au dixième, virgule à la française', () => {
    expect(formatSeconds(24_300)).toBe('24,3 s')
    expect(formatSeconds(30_000)).toBe('30,0 s')
    expect(formatSeconds(0)).toBe('0,0 s')
  })

  it.each([
    [2_460, 'round', '2,5 s'],
    [2_440, 'round', '2,4 s'],
    [2_401, 'ceil', '2,5 s'],
    [2_400, 'ceil', '2,4 s'],
    [2_499, 'floor', '2,4 s'],
    [2_500, 'floor', '2,5 s'],
  ] as const)('%d ms en mode %s → %s', (ms, rounding, expected) => {
    expect(formatSeconds(ms, rounding)).toBe(expected)
  })

  it('arrondit au plus proche par défaut', () => {
    expect(formatSeconds(2_460)).toBe(formatSeconds(2_460, 'round'))
  })

  it("n'affiche « 0,0 s » en compte à rebours qu'à zéro pile", () => {
    expect(formatSeconds(1, 'ceil')).toBe('0,1 s')
    expect(formatSeconds(0, 'ceil')).toBe('0,0 s')
  })

  it('ramène les durées négatives à zéro, sans signe', () => {
    expect(formatSeconds(-40)).toBe('0,0 s')
    expect(formatSeconds(-40, 'floor')).toBe('0,0 s')
    expect(formatSeconds(-0.01, 'ceil')).toBe('0,0 s')
  })

  it('chronomètre (floor) + temps restant (ceil) = durée du niveau', () => {
    const duration = 30_000
    for (let elapsed = 0; elapsed <= duration; elapsed += 7.3) {
      const shown = tenthsOf(formatSeconds(elapsed, 'floor'))
      const left = tenthsOf(formatSeconds(duration - elapsed, 'ceil'))
      expect(shown + left, `écoulé ${elapsed} ms`).toBe(duration / 100)
    }
  })
})
