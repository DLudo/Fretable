import { NATURAL_PCS, NOTES, type Notation, type PitchClass } from '@/game/music/notes'

/**
 * Géométrie d'une octave de piano, exprimée en largeurs de touche blanche.
 * Les tailles réelles en px découlent de la largeur du conteneur.
 */
export const WHITE_KEY_COUNT = NATURAL_PCS.length

/** Largeur d'une touche noire, relative à une touche blanche (≈ 13,7 / 23,5 mm). */
export const BLACK_KEY_WIDTH = 0.58

/** Hauteur d'une touche noire, relative à une touche blanche. */
export const BLACK_KEY_HEIGHT = 0.62

export interface BlackKeyPlacement {
  pc: PitchClass
  /** Centre de la touche, en largeurs de touche blanche depuis le bord gauche de Do. */
  center: number
}

/**
 * Comme sur un vrai clavier, les touches noires ne sont pas centrées sur les
 * jonctions : chaque groupe est divisé en parts égales (5 pour Do–Mi, 7 pour
 * Fa–Si), ce qui écarte Do♯/Ré♯ et Fa♯/La♯ vers l'extérieur de leur groupe.
 */
export const BLACK_KEYS: readonly BlackKeyPlacement[] = [
  { pc: 1, center: 0.9 },
  { pc: 3, center: 2.1 },
  { pc: 6, center: 3 + 6 / 7 },
  { pc: 8, center: 5 },
  { pc: 10, center: 3 + 22 / 7 },
]

export type PianoKeyColor = 'white' | 'black'

export interface PianoKeySlot {
  pc: PitchClass
  color: PianoKeyColor
  /** Touches noires seulement : boîte CSS (en %) dans le lit de touches. */
  box?: { left: string; width: string; height: string }
}

/** Boîte CSS (en %) d'une touche noire dans le lit de touches. */
export function blackKeyBox(center: number): { left: string; width: string; height: string } {
  const toPercent = (units: number) => `${(units / WHITE_KEY_COUNT) * 100}%`
  return {
    left: toPercent(center - BLACK_KEY_WIDTH / 2),
    width: toPercent(BLACK_KEY_WIDTH),
    height: `${BLACK_KEY_HEIGHT * 100}%`,
  }
}

/**
 * Les douze touches dans l'ordre chromatique, qui est aussi l'ordre de tabulation.
 * Les blanches remplissent la grille de 7 colonnes ; les noires sont posées par-dessus.
 */
export const PIANO_KEYS: readonly PianoKeySlot[] = NOTES.map(({ pc }) => {
  const black = BLACK_KEYS.find((key) => key.pc === pc)
  return black ? { pc, color: 'black', box: blackKeyBox(black.center) } : { pc, color: 'white' }
})

/** Nom accessible en français : « Do dièse », « Ré », « F dièse »… */
export function spokenNoteName(pc: PitchClass, notation: Notation): string {
  const info = NOTES[pc]
  const base = info[notation].replace('♯', '')
  return info.sharp ? `${base} dièse` : base
}

/** Raccourci au format `aria-keyshortcuts` (« Q », « Shift+Q »). */
export function ariaShortcut(hint: string | null): string | undefined {
  if (!hint) return undefined
  return hint.startsWith('⇧') ? `Shift+${hint.slice(1)}` : hint
}
