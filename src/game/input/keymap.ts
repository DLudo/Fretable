import { sharpOf, type PitchClass } from '@/game/music/notes'

/**
 * Correspondance clavier → notes naturelles (Do Ré Mi Fa Sol La Si).
 * Rangée de repos d'un clavier AZERTY : main gauche q s d, main droite j k l m.
 * La correspondance se fait sur le caractère produit (`KeyboardEvent.key`).
 */
export const NATURAL_KEYMAP: Readonly<Record<string, PitchClass>> = {
  q: 0, // Do
  s: 2, // Ré
  d: 4, // Mi
  j: 5, // Fa
  k: 7, // Sol
  l: 9, // La
  m: 11, // Si
}

export type KeyResolution =
  | { kind: 'note'; pc: PitchClass; natural: PitchClass; sharp: boolean }
  /** Maj + Mi ou Maj + Si : pas de touche noire correspondante. */
  | { kind: 'no-sharp'; natural: PitchClass }

/**
 * Résout une frappe. `shift` active le mode dièse.
 * Renvoie `null` pour une touche non attribuée.
 */
export function resolveKey(key: string, shift: boolean): KeyResolution | null {
  const natural = NATURAL_KEYMAP[key.toLowerCase()]
  if (natural === undefined) return null
  if (!shift) return { kind: 'note', pc: natural, natural, sharp: false }
  const sharp = sharpOf(natural)
  if (sharp === null) return { kind: 'no-sharp', natural }
  return { kind: 'note', pc: sharp, natural, sharp: true }
}

/** Libellé de raccourci à afficher sur chaque touche du piano. */
export function keyHint(pc: PitchClass): string | null {
  for (const [key, natural] of Object.entries(NATURAL_KEYMAP)) {
    if (natural === pc) return key.toUpperCase()
    if (sharpOf(natural) === pc) return `⇧${key.toUpperCase()}`
  }
  return null
}
