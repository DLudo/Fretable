import { NATURAL_PCS, NOTES, type Notation, type PitchClass } from '@/game/music/notes'

/**
 * Géométrie d'une octave de piano, exprimée en largeurs de touche blanche.
 * Les tailles réelles en px découlent de la largeur du conteneur.
 */
export const WHITE_KEY_COUNT = NATURAL_PCS.length

/** Largeur d'une touche noire, relative à une touche blanche (≈ 13,7 / 23,5 mm). */
export const BLACK_KEY_WIDTH = 0.58

/** Largeur maximale d'une touche noire : sur un clavier étroit, elle s'élargit jusque-là. */
export const BLACK_KEY_MAX_WIDTH = 0.66

/** Largeur visée pour une touche noire (cible tactile confortable), bornée par les deux ratios. */
export const BLACK_KEY_TARGET_PX = 40

/** Hauteur d'une touche noire, relative à une touche blanche. */
export const BLACK_KEY_HEIGHT = 0.62

/** Glyphe « Maj » des raccourcis de dièse (« ⇧Q »). */
export const SHIFT_GLYPH = '⇧'

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
  /** Touches noires seulement : boîte CSS dans le lit de touches. */
  box?: { left: string; width: string; height: string }
}

/** Largeur en touches blanches → pourcentage du lit de touches. */
const toPercent = (units: number) => `${+((units / WHITE_KEY_COUNT) * 100).toFixed(4)}%`

/**
 * Largeur CSS d'une touche noire : {@link BLACK_KEY_TARGET_PX} si possible, entre
 * 0,58 et 0,66 touche blanche. Sur un clavier large, elle garde la proportion
 * réaliste ; sur un clavier étroit (téléphone), elle s'élargit pour rester jouable.
 * Surchargeable en CSS via `--black-key-width` sur un ancêtre.
 */
export const BLACK_KEY_WIDTH_CSS = `var(--black-key-width, clamp(${toPercent(BLACK_KEY_WIDTH)}, ${BLACK_KEY_TARGET_PX}px, ${toPercent(BLACK_KEY_MAX_WIDTH)}))`

/** Boîte CSS d'une touche noire dans le lit de touches, centrée sur `center`. */
export function blackKeyBox(center: number): { left: string; width: string; height: string } {
  return {
    left: `calc(${toPercent(center)} - ${BLACK_KEY_WIDTH_CSS} / 2)`,
    width: BLACK_KEY_WIDTH_CSS,
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

/** Décompose un raccourci affiché : « ⇧Q » → Maj + « Q ». */
export function splitHint(hint: string): { shift: boolean; key: string } {
  return hint.startsWith(SHIFT_GLYPH)
    ? { shift: true, key: hint.slice(SHIFT_GLYPH.length) }
    : { shift: false, key: hint }
}

/** Raccourci au format `aria-keyshortcuts` (« Q », « Shift+Q »). */
export function ariaShortcut(hint: string | null): string | undefined {
  if (!hint) return undefined
  const { shift, key } = splitHint(hint)
  return shift ? `Shift+${key}` : key
}
