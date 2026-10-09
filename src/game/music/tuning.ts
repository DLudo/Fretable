import { toPitchClass, type PitchClass } from './notes'

export interface StringSpec {
  /** Nom usuel de la corde à vide (« Mi grave », etc.). */
  name: string
  /** Hauteur MIDI de la corde à vide (Mi grave standard = 40). */
  midi: number
  /** Diamètre de la corde en millimètres (tirant .010–.046 par défaut). */
  gauge: number
  /** Corde filée (wound) ou lisse. */
  wound: boolean
}

export interface Tuning {
  id: string
  name: string
  /** Cordes ordonnées de la plus grave (index 0 = 6ᵉ corde) à la plus aiguë. */
  strings: readonly StringSpec[]
}

const INCH = 25.4

export const STANDARD_TUNING: Tuning = {
  id: 'standard',
  name: 'Accordage standard (Mi La Ré Sol Si Mi)',
  strings: [
    { name: 'Mi grave', midi: 40, gauge: 0.046 * INCH, wound: true },
    { name: 'La', midi: 45, gauge: 0.036 * INCH, wound: true },
    { name: 'Ré', midi: 50, gauge: 0.026 * INCH, wound: true },
    { name: 'Sol', midi: 55, gauge: 0.017 * INCH, wound: false },
    { name: 'Si', midi: 59, gauge: 0.013 * INCH, wound: false },
    { name: 'Mi aigu', midi: 64, gauge: 0.01 * INCH, wound: false },
  ],
}

export function midiAt(tuning: Tuning, stringIndex: number, fret: number): number {
  const string = tuning.strings[stringIndex]
  if (!string) throw new RangeError(`Corde inexistante : ${stringIndex}`)
  return string.midi + fret
}

export function pitchClassAt(tuning: Tuning, stringIndex: number, fret: number): PitchClass {
  return toPitchClass(midiAt(tuning, stringIndex, fret))
}

/** Numéro de corde du guitariste (1 = Mi aigu … 6 = Mi grave). */
export function stringNumber(tuning: Tuning, stringIndex: number): number {
  return tuning.strings.length - stringIndex
}
