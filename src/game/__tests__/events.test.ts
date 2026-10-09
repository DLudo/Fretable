import { describe, expect, it, vi } from 'vitest'

import {
  createGameEventBus,
  diffGameEvents,
  emitGameEvent,
  EMPTY_EVENT_SNAPSHOT,
  type GameEvent,
  type GameEventSnapshot,
} from '@/game/engine/events'
import { gameReducer } from '@/game/engine/reducer'
import type { Challenge, GameAction, GameState } from '@/game/engine/types'
import type { PitchClass } from '@/game/music/notes'

import { testState } from './fixtures'

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
    let state: GameState = testState()
    let emitted: GameEventSnapshot = EMPTY_EVENT_SNAPSHOT
    const flush = () => {
      const snapshot = {
        phase: state.phase,
        challenge: state.challenge,
        lastResult: state.lastResult,
        combo: state.combo,
        assist: state.assist,
        triad: state.triad,
        lastTriad: state.lastTriad,
        scaleRun: state.scaleRun,
        lastScaleRun: state.lastScaleRun,
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
      case 'assist':
        return `assist:${event.payload ? event.payload.remaining : 'off'}`
      case 'triad':
        return `triad:${event.payload ? event.payload.step : 'off'}`
      case 'triadResult':
        return `triadResult:${event.payload.success ? 'success' : 'missed'}`
      case 'scaleRun':
        return `scaleRun:${event.payload ? event.payload.step : 'off'}`
      case 'scaleResult':
        return `scaleResult:${event.payload.perfect ? 'perfect' : event.payload.hits}`
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

  it('annonce le décompte, puis la partie et sa première note', () => {
    const log = record([
      { type: 'prepare', now: 0 },
      { type: 'start', now: 3000, challenge: challenge(1, 0) },
    ])
    expect(log).toEqual(['phase:ready', 'phase:starting', 'phase:playing', 'challenge:1'])
  })

  it('annonce la triade note après note, puis son issue', () => {
    const voicing = {
      root: 9 as PitchClass,
      quality: 'minor' as const,
      notes: [
        { stringIndex: 0, fret: 5, pc: 9 as PitchClass },
        { stringIndex: 1, fret: 3, pc: 0 as PitchClass },
        { stringIndex: 2, fret: 2, pc: 4 as PitchClass },
      ] as const,
      scale: null,
    }
    const triadNote = (id: number, step: number) => ({ ...voicing.notes[step], id, triad: true })
    const log = record([
      { type: 'start', now: 0, challenge: challenge(1, 2) },
      { type: 'guess', pc: 2, now: 1000 },
      { type: 'next', challenge: triadNote(2, 0), now: 1400, triad: voicing },
      { type: 'guess', pc: 9, now: 2000 },
      { type: 'next', challenge: triadNote(3, 1), now: 2400 },
      { type: 'guess', pc: 0, now: 3000 },
      { type: 'next', challenge: triadNote(4, 2), now: 3400 },
      { type: 'guess', pc: 4, now: 4000 },
    ])
    expect(log.slice(4)).toEqual([
      'triad:0',
      'challenge:2',
      'guess:true',
      'triad:1',
      'challenge:3',
      'guess:true',
      'triad:2',
      'challenge:4',
      'guess:true',
      'triad:off',
      'triadResult:success',
    ])
  })

  it('ne rediffuse rien quand rien ne change', () => {
    const snapshot: GameEventSnapshot = {
      phase: 'playing',
      challenge: challenge(1, 0),
      lastResult: null,
      combo: null,
      assist: null,
      triad: null,
      lastTriad: null,
      scaleRun: null,
      lastScaleRun: null,
    }
    expect(diffGameEvents(snapshot, { ...snapshot })).toEqual([])
  })
})
