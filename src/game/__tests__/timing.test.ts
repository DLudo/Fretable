import { describe, expect, it } from 'vitest'

import { GAME_FEEL } from '@/game/config'
import { endScreenAt } from '@/game/engine/selectors'
import type { GameState, GuessResult } from '@/game/engine/types'
import { remainingMs, type CountdownState } from '@/game/engine/useCountdown'
import { getLevel } from '@/game/levels/levels'

const level = getLevel(0)
const clock = (patch: Partial<CountdownState>): CountdownState => ({
  phase: 'playing',
  startedAt: 1000,
  endedAt: null,
  level,
  ...patch,
})

describe('temps restant', () => {
  it('est plein avant le départ', () => {
    expect(remainingMs(clock({ phase: 'ready', startedAt: null }), 50_000)).toBe(30_000)
  })

  it('décompte pendant la partie', () => {
    expect(remainingMs(clock({}), 11_000)).toBe(20_000)
    expect(remainingMs(clock({}), 30_999)).toBe(1)
  })

  it('reste borné à [0, durée]', () => {
    expect(remainingMs(clock({}), 500)).toBe(30_000)
    expect(remainingMs(clock({}), 31_000)).toBe(0)
    expect(remainingMs(clock({}), 90_000)).toBe(0)
  })

  it('se fige à la fin de la partie', () => {
    const won = clock({ phase: 'won', endedAt: 7000 })
    expect(remainingMs(won, 7000)).toBe(24_000)
    expect(remainingMs(won, 60_000)).toBe(24_000)
    expect(remainingMs(clock({ phase: 'lost', endedAt: 31_000 }), 40_000)).toBe(0)
  })
})

describe('écran de fin', () => {
  const result = (at: number): GuessResult => ({
    id: 1,
    challenge: { id: 1, stringIndex: 0, fret: 1, pc: 5 },
    guess: null,
    correct: false,
    streak: 0,
    at,
  })
  const end = (patch: Partial<GameState>) =>
    endScreenAt({ phase: 'lost', endedAt: 31_000, lastResult: null, ...patch })

  it('n’existe pas pendant la partie', () => {
    expect(end({ phase: 'ready', endedAt: null })).toBeNull()
    expect(end({ phase: 'playing', endedAt: null, lastResult: result(2000) })).toBeNull()
  })

  it('attend la dernière révélation après une victoire', () => {
    expect(end({ phase: 'won', endedAt: 7000, lastResult: result(7000) })).toBe(
      7000 + GAME_FEEL.victoryDelayMs,
    )
  })

  it('laisse lire la note révélée à la fin du temps', () => {
    expect(end({ lastResult: result(31_000) })).toBe(31_000 + GAME_FEEL.defeatDelayMs)
  })

  it('attend la fin d’une erreur commise juste avant l’échéance', () => {
    expect(end({ lastResult: result(30_800) })).toBe(30_800 + GAME_FEEL.defeatDelayMs)
  })

  it('s’affiche aussitôt quand aucune révélation ne joue', () => {
    expect(end({ lastResult: result(20_000) })).toBe(31_000)
    expect(end({})).toBe(31_000)
  })
})
