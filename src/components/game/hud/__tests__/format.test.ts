import { describe, expect, it } from 'vitest'

import { formatClock, formatDurationWords, formatSeconds } from '@/components/game/hud/format'

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

describe('formatClock', () => {
  it('garde le dixième sous la minute', () => {
    expect(formatClock(59_900, 'ceil')).toBe('59,9 s')
    expect(formatClock(9_250, 'ceil')).toBe('9,3 s')
  })

  it('passe en minutes et secondes au-delà', () => {
    expect(formatClock(120_000, 'ceil')).toBe('2:00')
    expect(formatClock(119_001, 'ceil')).toBe('2:00')
    expect(formatClock(119_000, 'ceil')).toBe('1:59')
    expect(formatClock(65_400, 'floor')).toBe('1:05')
    // La bascule se fait sans « 60,0 s » : 59,95 s s'affiche déjà « 1:00 ».
    expect(formatClock(59_950, 'ceil')).toBe('1:00')
  })

  it('ramène les durées négatives à zéro', () => {
    expect(formatClock(-5, 'ceil')).toBe('0,0 s')
  })
})

describe('formatDurationWords', () => {
  it('dit les minutes rondes en minutes, le reste en secondes', () => {
    expect(formatDurationWords(120_000)).toBe('2 minutes')
    expect(formatDurationWords(60_000)).toBe('1 minute')
    expect(formatDurationWords(30_000)).toBe('30 secondes')
    expect(formatDurationWords(90_000)).toBe('90 secondes')
  })
})
