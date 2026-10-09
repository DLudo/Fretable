/**
 * Petit générateur pseudo-aléatoire déterministe (mulberry32).
 * Un effet obtient la même « personnalité » à chaque rendu pour une même graine.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Valeur dans [min, max). */
export function range(random: () => number, min: number, max: number): number {
  return min + (max - min) * random()
}
