import { noteName, toPitchClass, type Notation, type PitchClass } from './notes'
import { midiAt, pitchClassAt, type Tuning } from './tuning'

/** Qualité d'une triade. Diminuée et augmentée viendront avec les modes (palier 1). */
export type TriadQuality = 'major' | 'minor'

/** Intervalles (demi-tons) depuis la fondamentale : fondamentale, tierce, quinte. */
export const TRIAD_INTERVALS: Record<TriadQuality, readonly [number, number, number]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
}

const QUALITY_NAME: Record<TriadQuality, string> = { major: 'majeur', minor: 'mineur' }

/** Une note posée sur le manche. */
export interface FretPosition {
  /** Index de corde (0 = Mi grave). */
  stringIndex: number
  fret: number
  pc: PitchClass
}

/** Une triade jouable : ses trois notes, de la fondamentale à la quinte. */
export interface TriadVoicing {
  root: PitchClass
  quality: TriadQuality
  /** Fondamentale, tierce, quinte : du grave à l'aigu, sur trois cordes voisines. */
  notes: readonly [FretPosition, FretPosition, FretPosition]
}

export interface VoicingRange {
  frets: { min: number; max: number }
  /** Cordes jouables (index). */
  strings: readonly number[]
  /** Écart maximal entre la plus basse et la plus haute case. */
  maxFretSpan: number
}

/** Classes de hauteur de la triade, de la fondamentale à la quinte. */
export function triadPitchClasses(
  root: PitchClass,
  quality: TriadQuality,
): [PitchClass, PitchClass, PitchClass] {
  const [a, b, c] = TRIAD_INTERVALS[quality]
  return [toPitchClass(root + a), toPitchClass(root + b), toPitchClass(root + c)]
}

/** « La mineur », « Fa♯ majeur »… */
export function chordName(
  root: PitchClass,
  quality: TriadQuality,
  notation: Notation = 'solfege',
): string {
  return `${noteName(root, notation)} ${QUALITY_NAME[quality]}`
}

/**
 * Toutes les triades jouables de cette fondamentale et de cette qualité :
 * position fondamentale serrée (fondamentale, tierce, quinte dans l'octave),
 * une note par corde sur trois cordes voisines, dans le périmètre donné, la
 * main ne s'écartant pas de plus de `maxFretSpan` cases.
 */
export function triadVoicings(
  tuning: Tuning,
  root: PitchClass,
  quality: TriadQuality,
  range: VoicingRange,
): TriadVoicing[] {
  const intervals = TRIAD_INTERVALS[quality]
  const playable = new Set(range.strings)
  const inFrets = (fret: number) => fret >= range.frets.min && fret <= range.frets.max
  const voicings: TriadVoicing[] = []

  for (let low = 0; low + 2 < tuning.strings.length; low++) {
    const strings = [low, low + 1, low + 2]
    if (!strings.every((s) => playable.has(s))) continue
    for (let fret = range.frets.min; fret <= range.frets.max; fret++) {
      if (pitchClassAt(tuning, low, fret) !== root) continue
      const rootMidi = midiAt(tuning, low, fret)
      const frets = strings.map((s, i) => rootMidi + intervals[i] - midiAt(tuning, s, 0))
      if (!frets.every(inFrets)) continue
      if (Math.max(...frets) - Math.min(...frets) > range.maxFretSpan) continue
      const at = (i: number): FretPosition => ({
        stringIndex: strings[i],
        fret: frets[i],
        pc: pitchClassAt(tuning, strings[i], frets[i]),
      })
      voicings.push({ root, quality, notes: [at(0), at(1), at(2)] })
    }
  }
  return voicings
}
