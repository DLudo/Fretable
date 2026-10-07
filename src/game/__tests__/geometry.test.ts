import { describe, expect, it } from 'vitest'

import { DEFAULT_NECK, createNeckLayout, fretDistance } from '@/game/fretboard/geometry'
import { createProjection, orientViewBox } from '@/game/fretboard/projection'

describe('géométrie du manche', () => {
  const layout = createNeckLayout()

  it('place la 12ᵉ frette à la moitié du diapason', () => {
    expect(fretDistance(12, 648)).toBeCloseTo(324, 6)
  })

  it('resserre les cases en montant vers les aigus', () => {
    const gaps = layout.frets.map((f, i) => f.x - (i === 0 ? 0 : layout.frets[i - 1].x))
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1])
    // Rapport constant de 2^(1/12) entre cases voisines.
    expect(gaps[0] / gaps[1]).toBeCloseTo(2 ** (1 / 12), 6)
  })

  it('évase la touche du sillet à la 12ᵉ frette', () => {
    expect(layout.frets[0].halfWidth * 2).toBeGreaterThan(DEFAULT_NECK.nutWidth)
    expect(layout.frets[11].halfWidth * 2).toBeCloseTo(DEFAULT_NECK.widthAt12, 6)
  })

  it('met la corde aiguë en haut par défaut', () => {
    const x = layout.fretCenterX(5)
    expect(layout.stringY(5, x)).toBeLessThan(layout.stringY(0, x))
    expect(createNeckLayout({ highStringOnTop: false }).stringY(5, x)).toBeGreaterThan(0)
  })

  it('garde les cordes sur la touche', () => {
    for (const fret of layout.frets) {
      for (let s = 0; s < 6; s++) {
        expect(Math.abs(layout.stringY(s, fret.x))).toBeLessThan(fret.halfWidth)
      }
    }
  })

  it('centre le repère dans la case, entre deux frettes', () => {
    const p = layout.position(0, 1)
    expect(p.x).toBeGreaterThan(0)
    expect(p.x).toBeLessThan(layout.fretX(1))
    const q = layout.position(2, 12)
    expect(q.x).toBeGreaterThan(layout.fretX(11))
    expect(q.x).toBeLessThan(layout.fretX(12))
  })

  it('pose un double repère à l’octave', () => {
    expect(layout.inlays.filter((i) => i.fret === 12)).toHaveLength(2)
    expect(layout.inlays.filter((i) => i.fret !== 12).map((i) => i.fret)).toEqual([3, 5, 7, 9])
  })

  it('respecte des proportions de guitare réelle', () => {
    const ratio = layout.endX / (layout.frets[11].halfWidth * 2)
    expect(ratio).toBeGreaterThan(6)
    expect(ratio).toBeLessThan(7)
    expect(layout.markerRadius * 2).toBeLessThan(DEFAULT_NECK.stringSpreadNut / 5)
  })

  it('projette en pixels comme preserveAspectRatio « meet »', () => {
    const { viewBox } = layout
    const proj = createProjection(viewBox, viewBox.width * 2, viewBox.height * 2 + 100)
    expect(proj.pxPerMm).toBeCloseTo(2, 6)
    expect(proj.toPx({ x: viewBox.x, y: viewBox.y })).toEqual({ x: 0, y: 50 })
  })

  it('fait pivoter le manche en portrait : sillet en haut, corde grave à gauche', () => {
    const { viewBox } = layout
    const vertical = orientViewBox(viewBox, 'vertical')
    expect(vertical.width).toBeCloseTo(viewBox.height, 6)
    expect(vertical.height).toBeCloseTo(viewBox.width, 6)
    const proj = createProjection(viewBox, vertical.width * 2, vertical.height * 2, 'vertical')
    const nut = proj.toPx({ x: 0, y: 0 })
    const twelfth = proj.toPx({ x: layout.fretX(12), y: 0 })
    expect(twelfth.y).toBeGreaterThan(nut.y)
    expect(twelfth.x).toBeCloseTo(nut.x, 6)
    const x = layout.fretCenterX(5)
    expect(proj.toPx(layout.position(0, 5)).x).toBeLessThan(proj.toPx(layout.position(5, 5)).x)
    expect(proj.toPx({ x, y: viewBox.y }).x).toBeCloseTo(vertical.width * 2, 6)
  })
})
