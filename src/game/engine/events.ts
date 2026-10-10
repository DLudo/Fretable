import type {
  AssistState,
  Challenge,
  ComboState,
  GamePhase,
  GuessResult,
  ScaleRunOutcome,
  ScaleRunState,
  TriadIntro,
  TriadOutcome,
  TriadState,
} from './types'

/**
 * Bus d'événements du jeu : point d'accroche pour tout ce qui réagit au jeu
 * sans en faire partie (sons, vibrations, animations globales, analytics…).
 */
export interface GameEventMap {
  challenge: Challenge
  guess: GuessResult
  phase: GamePhase
  /** Combo déclenché, rechargé (nouvel `endsAt`) ou éteint (`null`). */
  combo: ComboState | null
  /** Coup de pouce offert, entamé (`remaining` décroît) ou terminé (`null`). */
  assist: AssistState | null
  /** Triade annoncée (pause « Trouve Fa majeur ») ou annonce terminée (`null`). */
  triadIntro: TriadIntro | null
  /** Triade commencée, avancée d'une note (`step`) ou terminée (`null`). */
  triad: TriadState | null
  /** Issue d'une triade, à sa dernière note : réussie ou manquée. */
  triadResult: TriadOutcome
  /** Parcours de gamme ouvert, avancé d'une note (`step`) ou terminé (`null`). */
  scaleRun: ScaleRunState | null
  /** Issue d'un parcours de gamme, à sa dernière note. */
  scaleResult: ScaleRunOutcome
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

/** Un événement du bus, prêt à être diffusé. */
export type GameEvent = {
  [K in keyof GameEventMap]: { type: K; payload: GameEventMap[K] }
}[keyof GameEventMap]

/** Ce que le bus a déjà diffusé (ou doit diffuser) de l'état du jeu. */
export interface GameEventSnapshot {
  phase: GamePhase | null
  challenge: Challenge | null
  lastResult: GuessResult | null
  combo: ComboState | null
  assist: AssistState | null
  triadIntro: TriadIntro | null
  triad: TriadState | null
  lastTriad: TriadOutcome | null
  scaleRun: ScaleRunState | null
  lastScaleRun: ScaleRunOutcome | null
}

export const EMPTY_EVENT_SNAPSHOT: GameEventSnapshot = {
  phase: null,
  challenge: null,
  lastResult: null,
  combo: null,
  assist: null,
  triadIntro: null,
  triad: null,
  lastTriad: null,
  scaleRun: null,
  lastScaleRun: null,
}

/**
 * Événements à diffuser pour passer de `prev` à `next`, dans un ordre fixe :
 * tentative → combo → coup de pouce → annonce de triade → triade → issue de la triade → parcours
 * de gamme → issue du parcours → phase → note. D'où, au démarrage :
 * phase puis première note ; sur la dernière réponse ou à la fin du temps :
 * révélation, extinction du combo, puis phase. Une valeur inchangée n'est
 * jamais rediffusée.
 */
export function diffGameEvents(prev: GameEventSnapshot, next: GameEventSnapshot): GameEvent[] {
  const list: GameEvent[] = []
  if (next.lastResult && next.lastResult !== prev.lastResult)
    list.push({ type: 'guess', payload: next.lastResult })
  if (next.combo !== prev.combo) list.push({ type: 'combo', payload: next.combo })
  if (next.assist !== prev.assist) list.push({ type: 'assist', payload: next.assist })
  if (next.triadIntro !== prev.triadIntro)
    list.push({ type: 'triadIntro', payload: next.triadIntro })
  if (next.triad !== prev.triad) list.push({ type: 'triad', payload: next.triad })
  if (next.lastTriad && next.lastTriad !== prev.lastTriad)
    list.push({ type: 'triadResult', payload: next.lastTriad })
  if (next.scaleRun !== prev.scaleRun) list.push({ type: 'scaleRun', payload: next.scaleRun })
  if (next.lastScaleRun && next.lastScaleRun !== prev.lastScaleRun)
    list.push({ type: 'scaleResult', payload: next.lastScaleRun })
  if (next.phase && next.phase !== prev.phase) list.push({ type: 'phase', payload: next.phase })
  if (next.challenge && next.challenge !== prev.challenge)
    list.push({ type: 'challenge', payload: next.challenge })
  return list
}

export function emitGameEvent<K extends keyof GameEventMap>(
  bus: GameEventBus,
  event: { type: K; payload: GameEventMap[K] },
): void {
  bus.emit(event.type, event.payload)
}
