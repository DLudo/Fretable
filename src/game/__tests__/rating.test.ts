import { describe, expect, it } from 'vitest'

import { RATING_RULES } from '@/game/config'
import {
  rateGame,
  ratingRulesFor,
  referenceScore,
  remainingShare,
  retainedScore,
} from '@/game/engine/rating'
import { createInitialState, gameReducer } from '@/game/engine/reducer'
import type { Challenge, GameState, GuessResult } from '@/game/engine/types'
import { getLevel } from '@/game/levels/levels'

/**
 * Le tableau de référence a été étalonné sur un niveau de 30 s : la notation
 * est évaluée sur ce niveau-là, quelle que soit la durée du niveau 1 en jeu.
 */
const level = { ...getLevel(0), durationMs: 30_000 }
const note = (id: number): Challenge => ({ id, stringIndex: 0, fret: 1, pc: 5 })

/** Partie jouée par le vrai moteur : une réponse toutes les `reactions[i]` ms, erreurs aux index donnés. */
function play(reactions: number[], wrongAt: number[] = []): GameState {
  let s = gameReducer(createInitialState(0), { type: 'start', now: 0, challenge: note(0) })
  let t = 0
  for (let i = 0; i < reactions.length && s.phase === 'playing'; i++) {
    t += reactions[i]
    s = gameReducer(s, { type: 'comboExpire', now: t })
    const wrong = wrongAt.includes(i)
    s = gameReducer(s, { type: 'guess', pc: wrong ? 0 : 5, now: t, roll: 1 })
    if (s.phase !== 'playing') break
    t += wrong ? 950 : 420
    s = gameReducer(s, { type: 'comboExpire', now: t })
    s = gameReducer(s, { type: 'next', challenge: note(i + 1), now: t })
  }
  return { ...s, level }
}

const pace = (ms: number, count = 6) => Array<number>(count).fill(ms)

describe('référence', () => {
  it('reprend le score du moteur à l’allure étalon', () => {
    expect(referenceScore(level, RATING_RULES.referencePaceMs)).toBe(3600)
    expect(referenceScore(level, 1500)).toBe(play(pace(1500)).score)
    expect(referenceScore(level, 800)).toBe(play(pace(800)).score)
  })

  it('mesure le temps restant en part de la durée du niveau', () => {
    expect(remainingShare(play(pace(1500)))).toBeCloseTo(0.63, 5)
    expect(remainingShare({ level, startedAt: 0, endedAt: null })).toBe(0)
    expect(remainingShare({ level, startedAt: 0, endedAt: 45_000 })).toBe(0)
  })
})

describe('étoiles', () => {
  // Le tableau validé : allure par note → étoiles.
  it.each([
    ['0,8 s', pace(800), [], 3],
    ['1,9 s', pace(1900), [], 3],
    ['2,5 s', pace(2500), [], 2],
    ['1,5 s avec 2 erreurs', pace(1500, 8), [2, 5], 2],
    ['2,9 s', pace(2900), [], 2],
    ['3,2 s', pace(3200), [], 1],
    ['4,5 s', pace(4500), [], 1],
  ] as const)('%s', (_, reactions, wrongAt, stars) => {
    const s = play([...reactions], [...wrongAt])
    expect(s.phase).toBe('won')
    expect(rateGame(s).stars).toBe(stars)
  })

  it('donne les indices attendus', () => {
    expect(rateGame(play(pace(2500))).index).toBeCloseTo(0.72, 2)
    expect(rateGame(play(pace(1500, 8), [2, 5])).index).toBeCloseTo(0.7, 2)
    expect(rateGame(play(pace(3200))).index).toBeCloseTo(0.38, 2)
  })

  it('accorde l’étoile pile sur un seuil, malgré la virgule flottante', () => {
    // 3 500 points en 17,4 s : 0,6 × 35/36 + 0,4 × (0,42 / 0,63) = 0,85 exactement.
    const s = play([4864, 4111, 1626, 1646, 2800, 253])
    expect(s).toMatchObject({ phase: 'won', score: 3500, endedAt: 17_400 })
    expect(rateGame(s)).toMatchObject({ index: 0.85, stars: 3 })
  })

  it('n’en donne aucune sur une défaite', () => {
    const lost = gameReducer(play(pace(1500, 2)), { type: 'timeUp', now: 30_000 })
    expect(lost.phase).toBe('lost')
    expect(rateGame(lost).stars).toBe(0)
  })

  it('suit la part de référence figée : un compte à rebours plus court est plus exigeant', () => {
    const s = play(pace(1900))
    const shorter = { ...s, level: { ...level, durationMs: 20_000 } }
    expect(rateGame(s).stars).toBe(3)
    expect(rateGame(shorter).timeRatio).toBeLessThan(rateGame(s).timeRatio)
    expect(rateGame(shorter).stars).toBe(2)
  })

  it('accepte des réglages propres au niveau', () => {
    const strict = { ...level, rating: { threeStarsAt: 0.99 } }
    expect(ratingRulesFor(strict).threeStarsAt).toBe(0.99)
    expect(ratingRulesFor(strict).scoreWeight).toBe(RATING_RULES.scoreWeight)
    expect(rateGame({ ...play(pace(1900)), level: strict }).stars).toBe(2)
  })
})

describe('triade', () => {
  it('ne coûte pas d’étoile à performance égale', () => {
    // Même allure (1,5 s par note, sans erreur), avec une triade ouverte après la première note.
    const voicing = {
      root: 9 as const,
      quality: 'minor' as const,
      notes: [
        { stringIndex: 0, fret: 5, pc: 9 as const },
        { stringIndex: 1, fret: 3, pc: 0 as const },
        { stringIndex: 2, fret: 2, pc: 4 as const },
      ] as const,
      scale: null,
    }
    let s = gameReducer(createInitialState(0), { type: 'start', now: 0, challenge: note(0) })
    let t = 0
    for (let i = 0; i < 6; i++) {
      t += 1500
      s = gameReducer(s, { type: 'guess', pc: s.challenge!.pc, now: t, roll: 1 })
      if (s.phase !== 'playing') break
      t += 420
      const step = i === 0 ? 0 : s.triad?.step
      const challenge =
        step !== undefined && i < 3
          ? { ...voicing.notes[step], id: 10 + i, triad: true }
          : note(20 + i)
      s = gameReducer(s, {
        type: 'next',
        challenge,
        now: t,
        ...(i === 0 ? { triad: voicing } : {}),
      })
    }
    expect(s.lastTriad).toMatchObject({ success: true, slot: 1 })
    const withTriad = rateGame({ ...s, level })
    const without = rateGame(play(pace(1500)))
    // Moins de points (le combo s'éteint), mais la même note : la référence vit la triade aussi.
    expect(s.score).toBeLessThan(play(pace(1500)).score)
    expect(withTriad.stars).toBe(without.stars)
    expect(withTriad.scoreRatio).toBe(1)
    expect(referenceScore(level, 1500, 1)).toBe(s.score)
  })
})

describe('coup de pouce', () => {
  const hit = (points: number, assisted: boolean): GuessResult => ({
    id: 0,
    challenge: note(0),
    guess: 5,
    correct: true,
    streak: 1,
    at: 0,
    reactionMs: 400,
    basePoints: points,
    multiplier: 1,
    points,
    comboTriggered: false,
    assisted,
  })
  const miss: GuessResult = { ...hit(0, true), guess: 0, correct: false }

  it('ne compte ses trois réussites que pour une note', () => {
    const results = [hit(200, false), hit(1000, true), miss, hit(600, true), hit(800, true)]
    expect(retainedScore(results)).toBe(200 + 800)
  })

  it('n’accorde aucun avantage au temps offert', () => {
    // Fin à 34 s grâce aux 10 s accordées : il ne reste rien de la durée du niveau.
    expect(remainingShare({ level, startedAt: 0, endedAt: 34_000 })).toBe(0)
  })

  it('peut plafonner les étoiles quand l’aide a servi', () => {
    const s = { ...play(pace(800)), assistUsed: true }
    expect(rateGame(s).stars).toBe(3)
    expect(rateGame(s, { ...RATING_RULES, maxStarsWithAssist: 2 }).stars).toBe(2)
    expect(rateGame(s, { ...RATING_RULES, maxStarsWithAssist: 0 }).stars).toBe(1)
  })
})
