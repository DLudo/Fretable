import { useCallback, useEffect, useReducer } from 'react'

import type { Random } from '@/game/engine/challenge'
import { getLevel } from '@/game/levels/levels'
import type { PitchClass } from '@/game/music/notes'
import { STANDARD_TUNING, type Tuning } from '@/game/music/tuning'
import { createBossChart } from './chart'
import { bossReducer, createBossState, nextMissAt } from './reducer'
import type { BossAction, BossState } from './types'

const now = () => performance.now()

/** Réducteur aux réglages par défaut (`BOSS_RULES`), à la signature attendue par React. */
const reduce = (state: BossState, action: BossAction): BossState => bossReducer(state, action)

export interface BossGameOptions {
  tuning?: Tuning
  /** Hasard injectable (tests) ; `Math.random` par défaut. */
  random?: Random
  /** Niveau dont le boss reprend le périmètre (cordes, cases). */
  levelIndex?: number
}

/**
 * Boss final : relie le réducteur pur à l'horloge (`performance.now()`) et aux
 * entrées. Une minuterie juge « raté » chaque note dont la fenêtre se ferme
 * sans frappe ; l'affichage, lui, suit les images (voir `BossLayer`).
 */
export function useBossGame(options: BossGameOptions = {}) {
  const tuning = options.tuning ?? STANDARD_TUNING
  const random = options.random ?? Math.random
  const level = getLevel(options.levelIndex ?? 0)
  const [state, dispatch] = useReducer(reduce, undefined, () => createBossState())

  const start = useCallback(() => {
    const t = now()
    dispatch({ type: 'start', now: t, notes: createBossChart(level, tuning, random, t) })
  }, [level, tuning, random])

  const press = useCallback((pc: PitchClass) => dispatch({ type: 'press', pc, at: now() }), [])

  // Fenêtre de la note en cours close sans frappe : raté, à l'instant près.
  const missAt = nextMissAt(state)
  useEffect(() => {
    if (missAt === null) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'tick', at: now() }),
      Math.max(0, missAt - now()) + 1,
    )
    return () => window.clearTimeout(timer)
  }, [missAt])

  return { state, start, press, tuning, level }
}
