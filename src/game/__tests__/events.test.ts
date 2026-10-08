import { describe, expect, it, vi } from 'vitest'

import {
  createGameEventBus,
  diffGameEvents,
  emitGameEvent,
  EMPTY_EVENT_SNAPSHOT,
  type GameEvent,
  type GameEventSnapshot,
} from '@/game/engine/events'
import { createInitialState, gameReducer } from '@/game/engine/reducer'
import type { Challenge, GameAction, GameState } from '@/game/engine/types'
import type { PitchClass } from '@/game/music/notes'

const challenge = (id: number, pc: PitchClass): Challenge => ({ id, stringIndex: 0, fret: 1, pc })

describe("bus d'événements", () => {
  it('diffuse aux abonnés du bon type, jusqu’au désabonnement', () => {
    const bus = createGameEventBus()
    const onPhase = vi.fn()
    const onGuess = vi.fn()
    const off = bus.on('phase', onPhase)
    bus.on('guess', onGuess)
    bus.emit('phase', 'playing')
    emitGameEvent(bus, { type: 'phase', payload: 'won' })
    off()
    bus.emit('phase', 'lost')
    expect(onPhase.mock.calls).toEqual([['playing'], ['won']])
    expect(onGuess).not.toHaveBeenCalled()
  })
})

describe('ordre des événements', () => {
  /** Rejoue une suite d'actions et note les événements, comme `useGame`. */
  function record(actions: GameAction[]): string[] {
    const log: string[] = []
    let state: GameState = createInitialState(0)
    let emitted: GameEventSnapshot = EMPTY_EVENT_SNAPSHOT
    const flush = () => {
      const snapshot = {
        phase: state.phase,
        challenge: state.challenge,
        lastResult: state.lastResult,
        combo: state.combo,
      }
      for (const event of diffGameEvents(emitted, snapshot)) log.push(label(event))
      emitted = snapshot
    }
    flush()
    flush() // StrictMode rejoue l'effet au montage : rien ne doit être rediffusé.
    for (const action of actions) {
      state = gameReducer(state, action)
      flush()
    }
    return log
  }

  function label(event: GameEvent): string {
    switch (event.type) {
      case 'phase':
        return `phase:${event.payload}`
      case 'challenge':
        return `challenge:${event.payload.id}`
      case 'guess':
        return `guess:${event.payload.guess === null ? 'timeout' : event.payload.correct}`
      case 'combo':
        return `combo:${event.payload ? 'on' : 'off'}`
    }
  }

  it('annonce la phase avant la première note, puis la note avant la fin', () => {
    const actions: GameAction[] = [{ type: 'start', now: 0, challenge: challenge(1, 0) }]
    for (let i = 1; i <= 6; i++) {
      actions.push({ type: 'guess', pc: (i - 1) as PitchClass, now: i * 1000 })
      if (i < 6)
        actions.push({
          type: 'next',
          challenge: challenge(i + 1, i as PitchClass),
          now: i * 1000 + 500,
        })
    }
    const log = record(actions)
    expect(log.slice(0, 3)).toEqual(['phase:ready', 'phase:playing', 'challenge:1'])
    expect(log.slice(3, 5)).toEqual(['guess:true', 'challenge:2'])
    // Troisième réponse rapide : le combo s'allume, avant la note suivante.
    expect(log.slice(7, 10)).toEqual(['guess:true', 'combo:on', 'challenge:4'])
    // Victoire : la révélation, puis l'extinction du combo, puis la phase.
    expect(log.slice(-3)).toEqual(['guess:true', 'combo:off', 'phase:won'])
  })

  it('révèle la note en attente avant d’annoncer la défaite', () => {
    const log = record([
      { type: 'start', now: 0, challenge: challenge(1, 0) },
      { type: 'timeUp', now: 30_000 },
      { type: 'start', now: 40_000, challenge: challenge(2, 3) },
    ])
    expect(log).toEqual([
      'phase:ready',
      'phase:playing',
      'challenge:1',
      'guess:timeout',
      'phase:lost',
      'phase:playing',
      'challenge:2',
    ])
  })

  it('ne rediffuse rien quand rien ne change', () => {
    const snapshot: GameEventSnapshot = {
      phase: 'playing',
      challenge: challenge(1, 0),
      lastResult: null,
      combo: null,
    }
    expect(diffGameEvents(snapshot, { ...snapshot })).toEqual([])
  })
})
