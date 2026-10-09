/**
 * Classes de hauteur (pitch classes) : 0 = Do … 11 = Si.
 * Le jeu raisonne en classes de hauteur : l'octave n'intervient pas dans la réponse.
 */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export type NaturalLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

export type Notation = 'solfege' | 'english'

export interface NoteInfo {
  pc: PitchClass
  /** Lettre de la note naturelle de base (Do♯ → C). */
  letter: NaturalLetter
  sharp: boolean
  solfege: string
  english: string
}

const SHARP = '♯'

const NATURAL_SOLFEGE: Record<NaturalLetter, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

const CHROMATIC: ReadonlyArray<{ letter: NaturalLetter; sharp: boolean }> = [
  { letter: 'C', sharp: false },
  { letter: 'C', sharp: true },
  { letter: 'D', sharp: false },
  { letter: 'D', sharp: true },
  { letter: 'E', sharp: false },
  { letter: 'F', sharp: false },
  { letter: 'F', sharp: true },
  { letter: 'G', sharp: false },
  { letter: 'G', sharp: true },
  { letter: 'A', sharp: false },
  { letter: 'A', sharp: true },
  { letter: 'B', sharp: false },
]

export const NOTES: readonly NoteInfo[] = CHROMATIC.map(({ letter, sharp }, pc) => ({
  pc: pc as PitchClass,
  letter,
  sharp,
  solfege: NATURAL_SOLFEGE[letter] + (sharp ? SHARP : ''),
  english: letter + (sharp ? SHARP : ''),
}))

/** Les sept notes naturelles, de Do à Si. */
export const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11] as const satisfies readonly PitchClass[]

/** Les cinq altérations (touches noires) : Do♯ Ré♯ Fa♯ Sol♯ La♯. */
export const SHARP_PCS = [1, 3, 6, 8, 10] as const satisfies readonly PitchClass[]

export function toPitchClass(n: number): PitchClass {
  return (((n % 12) + 12) % 12) as PitchClass
}

export function isSharp(pc: PitchClass): boolean {
  return NOTES[pc].sharp
}

/**
 * Dièse d'une note naturelle, ou `null` lorsqu'il n'existe pas de touche noire
 * correspondante (Mi et Si : Mi♯ = Fa, Si♯ = Do).
 */
export function sharpOf(natural: PitchClass): PitchClass | null {
  if (isSharp(natural)) return null
  const next = toPitchClass(natural + 1)
  return isSharp(next) ? next : null
}

export function noteName(pc: PitchClass, notation: Notation = 'solfege'): string {
  return NOTES[pc][notation]
}
