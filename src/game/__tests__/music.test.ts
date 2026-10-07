import { describe, expect, it } from 'vitest'

import { NATURAL_PCS, SHARP_PCS, noteName, sharpOf, toPitchClass } from '@/game/music/notes'
import { STANDARD_TUNING, pitchClassAt, stringNumber } from '@/game/music/tuning'

describe('notes', () => {
  it('nomme les douze demi-tons en solfège', () => {
    expect(Array.from({ length: 12 }, (_, i) => noteName(toPitchClass(i)))).toEqual([
      'Do',
      'Do♯',
      'Ré',
      'Ré♯',
      'Mi',
      'Fa',
      'Fa♯',
      'Sol',
      'Sol♯',
      'La',
      'La♯',
      'Si',
    ])
  })

  it('distingue naturelles et altérations', () => {
    expect(NATURAL_PCS).toHaveLength(7)
    expect(SHARP_PCS).toHaveLength(5)
  })

  it("n'offre pas de dièse à Mi ni à Si", () => {
    expect(sharpOf(4)).toBeNull()
    expect(sharpOf(11)).toBeNull()
    expect(sharpOf(5)).toBe(6) // Fa♯ existe bel et bien
    expect(sharpOf(0)).toBe(1)
  })

  it('normalise les classes de hauteur négatives', () => {
    expect(toPitchClass(-1)).toBe(11)
    expect(toPitchClass(64)).toBe(4)
  })
})

describe('accordage standard', () => {
  it('produit les notes attendues', () => {
    // 6ᵉ corde (Mi grave), case 5 → La ; 5ᵉ corde case 2 → Si ; 3ᵉ corde case 1 → Sol♯
    expect(noteName(pitchClassAt(STANDARD_TUNING, 0, 5))).toBe('La')
    expect(noteName(pitchClassAt(STANDARD_TUNING, 1, 2))).toBe('Si')
    expect(noteName(pitchClassAt(STANDARD_TUNING, 3, 1))).toBe('Sol♯')
    expect(noteName(pitchClassAt(STANDARD_TUNING, 4, 1))).toBe('Do')
    expect(noteName(pitchClassAt(STANDARD_TUNING, 5, 12))).toBe('Mi')
  })

  it('numérote les cordes comme un guitariste', () => {
    expect(stringNumber(STANDARD_TUNING, 0)).toBe(6)
    expect(stringNumber(STANDARD_TUNING, 5)).toBe(1)
  })
})
