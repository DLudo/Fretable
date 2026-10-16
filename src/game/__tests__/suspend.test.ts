import { describe, expect, it } from 'vitest'

import { gameReducer } from '@/game/engine/reducer'
import { deadlineAt, playStartsAt, startCountdownMs } from '@/game/engine/selectors'
import type { Challenge, GameState, TriadPlan } from '@/game/engine/types'
import { remainingMs } from '@/game/engine/useCountdown'
import type { PitchClass } from '@/game/music/notes'

import { TEST_LEVEL, testState } from './fixtures'

const challenge = (id: number, pc: PitchClass): Challenge => ({ id, stringIndex: 0, fret: 1, pc })

/** Partie lancée à 1 000 ms, première note (Fa) affichée aussitôt. */
const started = (): GameState =>
  gameReducer(testState(), { type: 'start', now: 1000, challenge: challenge(1, 5) })

/** Suspend à `at`, reprend `forMs` plus tard. */
const pause = (s: GameState, at: number, forMs: number): GameState =>
  gameReducer(gameReducer(s, { type: 'suspend', now: at }), { type: 'resume', now: at + forMs })

describe('suspension d’une partie', () => {
  it('gèle tout : réponses, fin du temps, minuteurs', () => {
    const suspended = gameReducer(started(), { type: 'suspend', now: 2000 })
    expect(suspended.suspendedAt).toBe(2000)
    expect(gameReducer(suspended, { type: 'guess', pc: 5, now: 2500 })).toBe(suspended)
    expect(gameReducer(suspended, { type: 'timeUp', now: 99_000 })).toBe(suspended)
    expect(gameReducer(suspended, { type: 'comboExpire', now: 99_000 })).toBe(suspended)
    expect(deadlineAt(suspended)).toBeNull()
    // Le temps restant affiché se fige à l'instant de la suspension.
    expect(remainingMs(suspended, 50_000)).toBe(TEST_LEVEL.durationMs - 1000)
  })

  it('ne suspend qu’une partie en cours, et une seule fois', () => {
    expect(gameReducer(testState(), { type: 'suspend', now: 10 })).toMatchObject({
      suspendedAt: null,
    })
    const once = gameReducer(started(), { type: 'suspend', now: 2000 })
    expect(gameReducer(once, { type: 'suspend', now: 3000 }).suspendedAt).toBe(2000)
    expect(gameReducer(started(), { type: 'resume', now: 2000 })).toEqual(started())
  })

  it('reprend comme si de rien n’était : échéance, temps de réaction et combo décalés', () => {
    const withCombo = { ...started(), combo: { startedAt: 900, endsAt: 4000 } }
    const resumed = pause(withCombo, 2000, 10_000)
    expect(resumed).toMatchObject({
      suspendedAt: null,
      challengeShownAt: 11_000,
      pausedMs: 10_000,
      combo: { startedAt: 900, endsAt: 14_000 },
    })
    expect(deadlineAt(resumed)).toBe(1000 + TEST_LEVEL.durationMs + 10_000)
    // Réponse 1,5 s après la reprise : 2,5 s de réaction, la suspension n'y compte pas.
    const answered = gameReducer(resumed, { type: 'guess', pc: 5, now: 13_500 })
    expect(answered.lastResult).toMatchObject({ correct: true, reactionMs: 2500 })
  })

  it('pendant une annonce de triade : l’annonce reprend où elle en était', () => {
    const locked = gameReducer(started(), { type: 'guess', pc: 5, now: 1500 })
    // La mineur sur les cordes de La, Ré et Sol, sans forme de gamme.
    const plan: TriadPlan = {
      root: 9,
      quality: 'minor',
      notes: [
        { stringIndex: 0, fret: 5, pc: 9 },
        { stringIndex: 1, fret: 3, pc: 0 },
        { stringIndex: 2, fret: 2, pc: 4 },
      ],
      scale: null,
    }
    const intro = { ...locked, level: { ...TEST_LEVEL, targetCount: 24 }, triadCooldown: 0 }
    const announced = gameReducer(intro, { type: 'announceTriad', now: 2000, triad: plan })
    expect(announced.triadIntro).not.toBeNull()
    const resumed = pause(announced, 2500, 5000)
    // L'annonce repart d'où elle s'était arrêtée ; la pause du jeu, elle, compte la suspension.
    expect(resumed.triadIntro?.at).toBe(7000)
    expect(resumed.pausedAt).toBe(2000)
    expect(resumed.pausedMs).toBe(announced.pausedMs)
  })

  it('relance le décompte 3, 2, 1 depuis le début', () => {
    const starting = gameReducer(testState(), { type: 'prepare', now: 1000 })
    const suspended = gameReducer(starting, { type: 'suspend', now: 1500 })
    expect(playStartsAt(suspended)).toBeNull()
    const resumed = gameReducer(suspended, { type: 'resume', now: 9000 })
    expect(resumed).toMatchObject({ phase: 'starting', startingAt: 9000, suspendedAt: null })
    expect(playStartsAt(resumed)).toBe(9000 + startCountdownMs())
  })

  it('s’efface au redémarrage', () => {
    const suspended = gameReducer(started(), { type: 'suspend', now: 2000 })
    const restarted = gameReducer(suspended, {
      type: 'start',
      now: 3000,
      challenge: challenge(2, 7),
    })
    expect(restarted).toMatchObject({ phase: 'playing', suspendedAt: null, startedAt: 3000 })
  })
})
