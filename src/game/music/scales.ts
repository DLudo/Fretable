import type { FretPosition, TriadQuality, TriadVoicing } from './chords'
import { noteName, toPitchClass, type Notation, type PitchClass } from './notes'
import { midiAt, pitchClassAt, type Tuning } from './tuning'

/**
 * Gammes du bonus de mode. Sans le palier 1, seule la pentatonique est
 * accessible ; les modes (ionien, dorien…) viendront s'ajouter ici.
 */
export type ScaleKind = 'pentatonic'

/** Intervalles de la pentatonique, selon la couleur de la triade qu'elle prolonge. */
export const PENTATONIC_INTERVALS: Record<TriadQuality, readonly number[]> = {
  major: [0, 2, 4, 7, 9],
  minor: [0, 3, 5, 7, 10],
}

const SCALE_NAME: Record<ScaleKind, Record<TriadQuality, string>> = {
  pentatonic: { major: 'pentatonique majeure', minor: 'pentatonique mineure' },
}

/** Une forme de gamme sur le manche, parcourue du grave à l'aigu. */
export interface ScaleShape {
  root: PitchClass
  quality: TriadQuality
  kind: ScaleKind
  /** Notes dans l'ordre du parcours : hauteurs strictement croissantes. */
  notes: readonly FretPosition[]
}

/** « pentatonique majeure », « pentatonique mineure »… */
export function scaleKindName(quality: TriadQuality, kind: ScaleKind = 'pentatonic'): string {
  return SCALE_NAME[kind][quality]
}

/** « Do pentatonique majeure », « La pentatonique mineure »… */
export function scaleName(
  root: PitchClass,
  quality: TriadQuality,
  kind: ScaleKind = 'pentatonic',
  notation: Notation = 'solfege',
): string {
  return `${noteName(root, notation)} ${SCALE_NAME[kind][quality]}`
}

/** Classes de hauteur de la gamme. */
export function scalePitchClasses(root: PitchClass, quality: TriadQuality): PitchClass[] {
  return PENTATONIC_INTERVALS[quality].map((interval) => toPitchClass(root + interval))
}

/**
 * Les « boîtes » pentatoniques qui tiennent dans le périmètre : deux notes par
 * corde, de la corde grave à la corde aiguë, en suivant la gamme degré par
 * degré. Chaque boîte part d'une note de la gamme sur la corde la plus grave ;
 * on retrouve ainsi les cinq positions classiques, et leurs octaves.
 */
export function pentatonicBoxes(
  tuning: Tuning,
  root: PitchClass,
  quality: TriadQuality,
  frets: { min: number; max: number },
): FretPosition[][] {
  const scale = new Set(scalePitchClasses(root, quality))
  const nextAbove = (midi: number) => {
    let m = midi + 1
    while (!scale.has(toPitchClass(m))) m++
    return m
  }
  const boxes: FretPosition[][] = []
  for (let fret = frets.min; fret <= frets.max; fret++) {
    if (!scale.has(pitchClassAt(tuning, 0, fret))) continue
    const notes: FretPosition[] = []
    let midi = midiAt(tuning, 0, fret)
    let fits = true
    for (let s = 0; s < tuning.strings.length && fits; s++) {
      for (let k = 0; k < 2; k++) {
        const f = midi - midiAt(tuning, s, 0)
        if (f < frets.min || f > frets.max) {
          fits = false
          break
        }
        notes.push({ stringIndex: s, fret: f, pc: toPitchClass(midi) })
        midi = nextAbove(midi)
      }
    }
    if (fits) boxes.push(notes)
  }
  return boxes
}

/**
 * Forme pentatonique qui prolonge une triade : la boîte qui contient le plus
 * de ses notes (à leur place exacte), la plus proche d'elle à égalité.
 * Renvoie aussi l'index, dans la forme, des notes de la triade. `null` si
 * aucune boîte ne tient sur le manche.
 */
export function shapeAroundTriad(
  tuning: Tuning,
  triad: TriadVoicing,
  frets: { min: number; max: number },
): { shape: ScaleShape; accents: number[] } | null {
  const boxes = pentatonicBoxes(tuning, triad.root, triad.quality, frets)
  if (boxes.length === 0) return null
  const center = (notes: readonly FretPosition[]) =>
    notes.reduce((sum, n) => sum + n.fret, 0) / notes.length
  const triadCenter = center(triad.notes)
  const accentsOf = (box: readonly FretPosition[]) =>
    box.flatMap((note, i) =>
      triad.notes.some((t) => t.stringIndex === note.stringIndex && t.fret === note.fret)
        ? [i]
        : [],
    )
  let best = boxes[0]
  let bestAccents = accentsOf(best)
  for (const box of boxes.slice(1)) {
    const accents = accentsOf(box)
    const better =
      accents.length > bestAccents.length ||
      (accents.length === bestAccents.length &&
        Math.abs(center(box) - triadCenter) < Math.abs(center(best) - triadCenter))
    if (better) {
      best = box
      bestAccents = accents
    }
  }
  return {
    shape: { root: triad.root, quality: triad.quality, kind: 'pentatonic', notes: best },
    accents: bestAccents,
  }
}
