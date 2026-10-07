import type { RevealEffect, RevealOutcome } from './types'

/**
 * Registre des effets de révélation.
 *
 * Les effets s'enregistrent ici (voir `presets/index.ts`) ; vos animations
 * conçues en isolation s'y ajoutent de la même façon, sans toucher au jeu.
 */
const effects = new Map<string, RevealEffect>()

export function registerEffect(effect: RevealEffect): void {
  effects.set(effect.id, effect)
}

export function registerEffects(list: readonly RevealEffect[]): void {
  list.forEach(registerEffect)
}

export function unregisterEffect(id: string): void {
  effects.delete(id)
}

export function listEffects(outcome?: RevealOutcome): RevealEffect[] {
  const all = [...effects.values()]
  return outcome ? all.filter((e) => e.outcomes.includes(outcome)) : all
}

/**
 * Tire un effet pour une issue donnée, en évitant de rejouer `previousId`
 * (chaque note doit sembler différente de la précédente).
 */
export function pickEffect(
  outcome: RevealOutcome,
  random: () => number,
  previousId?: string | null,
): RevealEffect | null {
  const candidates = listEffects(outcome)
  const pool = candidates.length > 1 ? candidates.filter((e) => e.id !== previousId) : candidates
  if (pool.length === 0) return null
  const total = pool.reduce((sum, e) => sum + (e.weight ?? 1), 0)
  let roll = random() * total
  for (const effect of pool) {
    roll -= effect.weight ?? 1
    if (roll < 0) return effect
  }
  return pool[pool.length - 1]
}
