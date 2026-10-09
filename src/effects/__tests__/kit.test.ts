import { describe, expect, it } from 'vitest'

import {
  COMBO_MIN_STREAK,
  comboScaleFor,
  estimateLabelBox,
  labelFontSize,
  resolveCssColor,
  revealExit,
  revealPillStyle,
} from '@/effects/kit'

describe("kit d'effets", () => {
  it('la pastille de combo grossit avec la série, jusqu’à +40 %', () => {
    expect(comboScaleFor(COMBO_MIN_STREAK)).toBe(1)
    expect(comboScaleFor(COMBO_MIN_STREAK + 2)).toBeCloseTo(1.16)
    expect(comboScaleFor(COMBO_MIN_STREAK + 5)).toBeCloseTo(1.4)
    expect(comboScaleFor(50)).toBeCloseTo(1.4)
  })

  it("la police de l'étiquette suit le repère, bornée entre 13 et 24 px", () => {
    expect(labelFontSize(6)).toBe(13)
    expect(labelFontSize(21)).toBeCloseTo(15.75)
    expect(labelFontSize(60)).toBe(24)
  })

  it("estime la boîte de l'étiquette en comptant les caractères, pas les octets", () => {
    const box = estimateLabelBox(20, 'Sol♯')
    expect(box.halfW).toBeCloseTo((20 * (0.62 * 4 + 1.4)) / 2)
    expect(box.halfH).toBeCloseTo(17.6)
    expect(estimateLabelBox(20, 'Do').halfW).toBeLessThan(box.halfW)
  })

  it("compose les couleurs de l'étiquette et son halo", () => {
    expect(revealPillStyle('var(--c)', 'var(--f)', 18)).toEqual({
      background: 'var(--c)',
      color: 'var(--f)',
      boxShadow: '0 0 18px color-mix(in oklch, var(--c) 55%, transparent)',
    })
    expect(revealPillStyle('red', 'white', 10, 35).boxShadow).toBe(
      '0 0 10px color-mix(in oklch, red 35%, transparent)',
    )
    expect(revealPillStyle('red', 'white', 0).boxShadow).toBeUndefined()
  })

  it('cale le fondu de sortie juste avant la note suivante', () => {
    const exit = revealExit(420)
    expect(exit.fadeAt).toBeCloseTo(0.34)
    expect(exit.fadeFor).toBeCloseTo(0.26)
    expect(exit.lifetimeMs).toBeGreaterThanOrEqual(600)
    expect(exit.transition.duration).toBeCloseTo(0.6)
    const [start, fade, end] = exit.transition.times ?? []
    expect([start, end]).toEqual([0, 1])
    expect(fade).toBeCloseTo(0.34 / 0.6)
    // Budget minuscule : un maintien minimal est garanti.
    expect(revealExit(50).fadeAt).toBeCloseTo(0.2)
    expect(revealExit(950, { leadMs: 0, fadeMs: 100 }).lifetimeMs).toBe(1070)
  })

  it('résout une couleur sans DOM en la renvoyant telle quelle', () => {
    expect(resolveCssColor({} as Element, 'var(--feedback-success)')).toEqual({
      css: 'var(--feedback-success)',
      rgba: [0, 0, 0, 1],
    })
  })
})
