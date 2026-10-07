import type { Challenge, GamePhase, GuessResult } from './types'

/**
 * Bus d'événements du jeu : point d'accroche pour tout ce qui réagit au jeu
 * sans en faire partie (sons, vibrations, animations globales, analytics…).
 */
export interface GameEventMap {
  challenge: Challenge
  guess: GuessResult
  phase: GamePhase
}

type Handler<T> = (payload: T) => void

export interface GameEventBus {
  on<K extends keyof GameEventMap>(type: K, handler: Handler<GameEventMap[K]>): () => void
  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void
}

export function createGameEventBus(): GameEventBus {
  const handlers = new Map<keyof GameEventMap, Set<Handler<never>>>()
  return {
    on(type, handler) {
      const set = handlers.get(type) ?? new Set()
      set.add(handler as Handler<never>)
      handlers.set(type, set)
      return () => set.delete(handler as Handler<never>)
    },
    emit(type, payload) {
      handlers.get(type)?.forEach((handler) => (handler as Handler<typeof payload>)(payload))
    },
  }
}
