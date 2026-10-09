import { afterEach, describe, expect, it } from 'vitest'

import { listEffects, pickEffect, registerEffect, unregisterEffect } from '@/effects/registry'
import {
  buildRevealProps,
  DEFAULT_MAX_DURATION_MS,
  drawSeed,
  FALLBACK_REVEAL_MS,
  reducedMotionDurationMs,
  revealCapMs,
  revealGeometry,
  revealSeed,
  revealStream,
  usesReducedMotionFallback,
  type RevealGeometry,
  type RevealInput,
} from '@/effects/reveal-props'
import type { RevealEffect } from '@/effects/types'
import { GAME_FEEL } from '@/game/config'
import { createNeckLayout } from '@/game/fretboard/geometry'
import { createProjection } from '@/game/fretboard/projection'
import { seededRandom } from '@/lib/random'

const geometry: RevealGeometry = {
  x: 10,
  y: 20,
  markerSize: 21,
  pxPerMm: 3.38,
  stringAngle: 0,
  fretOffsets: [-30, -5, 5],
  layer: { width: 100, height: 50 },
}

const input = (over: Partial<RevealInput> = {}): RevealInput => ({
  revealId: 7,
  pc: 8,
  guess: 8,
  correct: true,
  streak: 3,
  stringIndex: 2,
  fret: 6,
  seed: 42,
  geometry,
  reducedMotion: false,
  onComplete: () => {},
  ...over,
})

describe('buildRevealProps', () => {
  it('bonne réponse : budget court, couleurs de succès, intensité selon la série', () => {
    const props = buildRevealProps(input())
    expect(props).toMatchObject({
      revealId: 7,
      outcome: 'correct',
      pc: 8,
      guess: 8,
      timedOut: false,
      label: 'Sol♯',
      stringIndex: 2,
      fret: 6,
      seed: 42,
      streak: 3,
      budgetMs: GAME_FEEL.holdAfterCorrectMs,
      color: 'var(--feedback-success)',
      colorForeground: 'var(--feedback-success-foreground)',
      highlight: 'var(--reveal-highlight)',
      reducedMotion: false,
      ...geometry,
    })
    expect(props.intensity).toBeCloseTo(3 / GAME_FEEL.maxStreakIntensity)
  })

  it("erreur : budget long, couleurs d'erreur, intensité nulle", () => {
    const props = buildRevealProps(input({ correct: false, guess: 0, streak: 0 }))
    expect(props).toMatchObject({
      outcome: 'wrong',
      guess: 0,
      timedOut: false,
      intensity: 0,
      budgetMs: GAME_FEEL.holdAfterWrongMs,
      color: 'var(--feedback-error)',
      colorForeground: 'var(--feedback-error-foreground)',
    })
  })

  it('temps écoulé : pas de note jouée, issue « wrong », budget de l’écran de fin', () => {
    const props = buildRevealProps(input({ correct: false, guess: null, streak: 0 }))
    expect(props).toMatchObject({
      outcome: 'wrong',
      guess: null,
      timedOut: true,
      intensity: 0,
      budgetMs: GAME_FEEL.defeatDelayMs,
      color: 'var(--feedback-error)',
    })
  })

  it("plafonne l'intensité et accepte une étiquette imposée", () => {
    const props = buildRevealProps(input({ streak: 40, label: 'Test' }))
    expect(props.intensity).toBe(1)
    expect(props.label).toBe('Test')
  })
})

describe('revealGeometry', () => {
  const layout = createNeckLayout()
  const vb = layout.viewBox
  const width = 1200
  const horizontal = createProjection(vb, width, (width * vb.height) / vb.width)
  // Même échelle à la verticale : le cadre orienté échange largeur et hauteur.
  const vertical = createProjection(vb, (width * vb.height) / vb.width, width, 'vertical')
  const fret = 5
  const stringIndex = 2

  it('à l’horizontale : corde ≈ 0 rad, frettes réelles de part et d’autre du repère', () => {
    const g = revealGeometry(layout, horizontal, stringIndex, fret)
    expect(Math.abs(g.stringAngle)).toBeLessThan(0.05)
    expect(g.markerSize).toBeCloseTo(layout.markerRadius * 2 * horizontal.pxPerMm)
    expect(g.layer).toEqual({ width: horizontal.width, height: horizontal.height })
    expect(g.fretOffsets).toHaveLength(layout.spec.lastFret + 1)
    for (let n = 1; n < g.fretOffsets.length; n++) {
      expect(g.fretOffsets[n]).toBeGreaterThan(g.fretOffsets[n - 1])
    }
    // Le repère est au milieu de la case : frettes 4 et 5 à égale distance.
    expect(g.fretOffsets[fret - 1]).toBeLessThan(0)
    expect(g.fretOffsets[fret]).toBeGreaterThan(0)
    expect(g.fretOffsets[fret]).toBeCloseTo(-g.fretOffsets[fret - 1], 6)
    // Le sillet (index 0) est à la distance réelle, à l'inclinaison de la corde près.
    const nutMm = layout.fretCenterX(fret)
    expect(-g.fretOffsets[0] / horizontal.pxPerMm).toBeCloseTo(nutMm, 0)
  })

  it('à la verticale : corde ≈ π/2, mêmes distances le long de la corde', () => {
    const h = revealGeometry(layout, horizontal, stringIndex, fret)
    const v = revealGeometry(layout, vertical, stringIndex, fret)
    expect(vertical.pxPerMm).toBeCloseTo(horizontal.pxPerMm)
    expect(Math.abs(v.stringAngle - Math.PI / 2)).toBeLessThan(0.05)
    v.fretOffsets.forEach((offset, n) => expect(offset).toBeCloseTo(h.fretOffsets[n], 6))
  })
})

describe('graines', () => {
  afterEach(() => listEffects().forEach((e) => unregisterEffect(e.id)))

  it('flux déterministe pour un même id et un même sel', () => {
    const a = revealStream(12, 99)
    const b = revealStream(12, 99)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
    expect(revealSeed(12, 99)).toBe(revealSeed(12, 99))
  })

  it('le sel de session change la suite des effets', () => {
    for (const id of ['a', 'b', 'c', 'd']) {
      registerEffect({ id, name: id, outcomes: ['correct'], Component: () => null })
    }
    const sequence = (salt: number) =>
      Array.from({ length: 12 }, (_, i) => pickEffect('correct', revealStream(i + 1, salt))?.id)
    expect(sequence(1)).toEqual(sequence(1))
    expect(sequence(1)).not.toEqual(sequence(2))
  })

  it("la graine de l'effet est décorrélée du tirage qui l'a choisi", () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    ids.forEach((id) =>
      registerEffect({ id, name: id, outcomes: ['correct'], Component: () => null }),
    )
    const bins = 5
    const stats = new Map(ids.map((id) => [id, { n: 0, sum: 0, hist: Array(bins).fill(0) }]))
    for (let revealId = 1; revealId <= 25_000; revealId++) {
      const random = revealStream(revealId, 0xc0ffee)
      const effect = pickEffect('correct', random)!
      const first = seededRandom(drawSeed(random))()
      const s = stats.get(effect.id)!
      s.n++
      s.sum += first
      s.hist[Math.min(bins - 1, Math.floor(first * bins))]++
    }
    for (const [, s] of stats) {
      expect(s.n).toBeGreaterThan(4000)
      expect(s.sum / s.n).toBeGreaterThan(0.47)
      expect(s.sum / s.n).toBeLessThan(0.53)
      // Chaque quintile reçoit ≈ 20 % des premiers tirages, quel que soit l'effet choisi.
      for (const count of s.hist) {
        expect(count / s.n).toBeGreaterThan(0.17)
        expect(count / s.n).toBeLessThan(0.23)
      }
    }
  })

  it('le lab suit le même chemin que le jeu', () => {
    registerEffect({ id: 'x', name: 'x', outcomes: ['wrong'], Component: () => null })
    registerEffect({ id: 'y', name: 'y', outcomes: ['wrong'], Component: () => null })
    const random = revealStream(31, 5)
    pickEffect('wrong', random)
    expect(drawSeed(random)).toBe(revealSeed(31, 5))
  })
})

describe('garde-fous du calque', () => {
  const effect = (over: Partial<RevealEffect> = {}): RevealEffect => ({
    id: 'e',
    name: 'e',
    outcomes: ['correct', 'wrong'],
    Component: () => null,
    ...over,
  })
  const calm = { reducedMotion: false, budgetMs: GAME_FEEL.holdAfterWrongMs }
  const reduced = { reducedMotion: true, budgetMs: GAME_FEEL.holdAfterWrongMs }

  it('remplace par la révélation réduite les effets qui ne gèrent pas le mouvement réduit', () => {
    expect(usesReducedMotionFallback(effect(), reduced)).toBe(true)
    expect(usesReducedMotionFallback(effect({ handlesReducedMotion: true }), reduced)).toBe(false)
    expect(usesReducedMotionFallback(effect(), calm)).toBe(false)
    expect(reducedMotionDurationMs(GAME_FEEL.holdAfterCorrectMs)).toBeGreaterThan(
      GAME_FEEL.holdAfterCorrectMs,
    )
  })

  it('limite de vie : par effet, défaut global, jamais sous les révélations de secours', () => {
    expect(revealCapMs(effect(), calm)).toBe(DEFAULT_MAX_DURATION_MS)
    expect(revealCapMs(effect({ maxDurationMs: 1500 }), calm)).toBe(1500)
    expect(revealCapMs(effect({ maxDurationMs: 100 }), calm)).toBe(FALLBACK_REVEAL_MS + 100)
    expect(revealCapMs(effect({ maxDurationMs: 100 }), reduced)).toBe(
      reducedMotionDurationMs(reduced.budgetMs) + 100,
    )
  })
})
