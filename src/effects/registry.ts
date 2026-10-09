import type { RevealEffect, RevealOutcome } from './types'

/**
 * Registre des effets de révélation.
 *
 * Les presets y sont versés par `effects/index.ts` (voir `presets/index.ts`) ;
 * vos animations conçues en isolation s'y ajoutent de la même façon, sans
 * toucher au jeu.
 */
const effects = new Map<string, RevealEffect>()

export function registerEffect(effect: RevealEffect): void {
  if (import.meta.env.DEV) {
    const existing = effects.get(effect.id)
    if (existing && existing !== effect) {
      console.warn(
        `[effects] Identifiant « ${effect.id} » déjà enregistré (« ${existing.name} ») : remplacé par « ${effect.name} ». Donnez un id unique à chaque effet.`,
      )
    }
    if (effect.outcomes.length === 0) {
      console.warn(
        `[effects] « ${effect.id} » n'a aucune issue (outcomes) : il ne sera jamais tiré.`,
      )
    }
  }
  effects.set(effect.id, effect)
}

export function registerEffects(list: readonly RevealEffect[]): void {
  list.forEach(registerEffect)
}

/**
 * Remplace tout le registre par `list`. Réévalué par le HMR, `effects/index.ts`
 * l'appelle : un effet renommé ou supprimé disparaît sans recharger la page.
 */
export function replaceEffects(list: readonly RevealEffect[]): void {
  effects.clear()
  registerEffects(list)
}

export function unregisterEffect(id: string): void {
  effects.delete(id)
}

export function listEffects(outcome?: RevealOutcome): RevealEffect[] {
  const all = [...effects.values()]
  return outcome ? all.filter((e) => e.outcomes.includes(outcome)) : all
}

/**
 * Tire un effet pour une issue donnée, pondéré par `weight`.
 *
 * `exclude` liste les effets à éviter par priorité décroissante (ex. le dernier
 * effet joué, puis le dernier de cette issue) : si tout exclure vide le tirage,
 * les dernières exclusions sont levées une à une. Consomme exactement un tirage
 * de `random` (aucun si l'issue n'a aucun effet).
 */
export function pickEffect(
  outcome: RevealOutcome,
  random: () => number,
  exclude: readonly (string | null | undefined)[] = [],
): RevealEffect | null {
  const candidates = listEffects(outcome)
  if (candidates.length === 0) return null
  let pool = candidates
  for (let kept = exclude.length; kept > 0; kept--) {
    const banned = new Set(exclude.slice(0, kept))
    const filtered = candidates.filter((e) => !banned.has(e.id))
    if (filtered.length > 0) {
      pool = filtered
      break
    }
  }
  const total = pool.reduce((sum, e) => sum + (e.weight ?? 1), 0)
  let roll = random() * total
  for (const effect of pool) {
    roll -= effect.weight ?? 1
    if (roll < 0) return effect
  }
  return pool[pool.length - 1]
}
