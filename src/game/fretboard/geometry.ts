import { STANDARD_TUNING, type Tuning } from '@/game/music/tuning'

/**
 * Géométrie physique du manche, en millimètres.
 *
 * Les valeurs par défaut décrivent une Stratocaster moderne (diapason 25,5″) :
 * c'est ce qui garantit des proportions réalistes. Le composant de rendu
 * travaille directement dans cet espace (viewBox SVG en mm) et laisse le
 * navigateur mettre à l'échelle.
 */
export interface NeckSpec {
  /** Diapason (sillet → chevalet). */
  scaleLength: number
  /** Dernière frette affichée. */
  lastFret: number
  /** Largeur de la touche au sillet. */
  nutWidth: number
  /** Largeur de la touche à la 12ᵉ frette (le profil est linéaire). */
  widthAt12: number
  /** Écart entre les axes des deux cordes extrêmes, au sillet. */
  stringSpreadNut: number
  /** Même écart, au chevalet. */
  stringSpreadBridge: number
  /** Épaisseur visible du sillet. */
  nutThickness: number
  /** Largeur d'un fil de frette (medium jumbo ≈ 2,4 mm). */
  fretWireWidth: number
  /** Diamètre des repères de touche. */
  inlayDiameter: number
  /** Frettes portant un repère ; `double` pour l'octave. */
  inlays: ReadonlyArray<{ fret: number; double?: boolean }>
  /** Portion de la case suivant `lastFret` encore visible (0–1). */
  overhang: number
}

export const DEFAULT_NECK: NeckSpec = {
  scaleLength: 648,
  lastFret: 12,
  nutWidth: 42.8,
  widthAt12: 52.1,
  stringSpreadNut: 35.3,
  stringSpreadBridge: 52.4,
  nutThickness: 5,
  fretWireWidth: 2.4,
  inlayDiameter: 6.35,
  inlays: [{ fret: 3 }, { fret: 5 }, { fret: 7 }, { fret: 9 }, { fret: 12, double: true }],
  overhang: 0.6,
}

export interface Point {
  x: number
  y: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface FretLine {
  /** Numéro de frette (1 = première frette après le sillet). */
  n: number
  /** Abscisse de l'axe du fil de frette. */
  x: number
  /** Demi-largeur de la touche à cette abscisse. */
  halfWidth: number
}

export interface StringLine {
  /** Index de corde (0 = Mi grave). */
  index: number
  from: Point
  to: Point
  gauge: number
  wound: boolean
}

export interface InlayDot {
  fret: number
  center: Point
  r: number
}

export interface NeckLayoutOptions {
  spec?: NeckSpec
  tuning?: Tuning
  /** Cordes aiguës en haut, comme une tablature (par défaut). */
  highStringOnTop?: boolean
  /** Marges autour de la touche (mm) — la marge basse accueille les numéros de frettes. */
  padding?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>
}

export interface NeckLayout {
  spec: NeckSpec
  tuning: Tuning
  highStringOnTop: boolean
  /** Cadre de rendu (mm), à utiliser tel quel comme viewBox SVG. */
  viewBox: Box
  /** Contour trapézoïdal de la touche (sillet exclu), sens horaire depuis le haut-gauche. */
  outline: readonly Point[]
  /** Sillet : rectangle de `x0` à `x1` (= 0), légèrement plus large que la touche. */
  nut: { x0: number; x1: number; halfWidth: number }
  frets: readonly FretLine[]
  strings: readonly StringLine[]
  inlays: readonly InlayDot[]
  /** Abscisse où la touche est coupée à droite. */
  endX: number
  /** Rayon du repère de note (dimensionné sur l'écart minimal entre cordes). */
  markerRadius: number
  /** Distance sillet → frette `n`. */
  fretX(n: number): number
  /** Centre de la case `fret` (entre les frettes `fret - 1` et `fret`). */
  fretCenterX(fret: number): number
  /** Ordonnée de la corde `stringIndex` à l'abscisse `x`. */
  stringY(stringIndex: number, x: number): number
  /** Position du repère pour une note (corde, case). */
  position(stringIndex: number, fret: number): Point
}

/** Règle des douze demi-tons égaux : distance sillet → frette `n`. */
export function fretDistance(n: number, scaleLength: number): number {
  return scaleLength * (1 - 2 ** (-n / 12))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function createNeckLayout(options: NeckLayoutOptions = {}): NeckLayout {
  const spec = options.spec ?? DEFAULT_NECK
  const tuning = options.tuning ?? STANDARD_TUNING
  const highStringOnTop = options.highStringOnTop ?? true
  const padding = { top: 2, right: 0, bottom: 9, left: 1, ...options.padding }

  const stringCount = tuning.strings.length
  const L = spec.scaleLength
  const x12 = fretDistance(12, L)

  const fretX = (n: number) => fretDistance(n, L)
  const halfWidthAt = (x: number) => lerp(spec.nutWidth, spec.widthAt12, x / x12) / 2
  const spreadAt = (x: number) => lerp(spec.stringSpreadNut, spec.stringSpreadBridge, x / L)

  const stringY = (stringIndex: number, x: number) => {
    const t = stringCount > 1 ? stringIndex / (stringCount - 1) : 0.5
    const signed = highStringOnTop ? 0.5 - t : t - 0.5
    return signed * spreadAt(x)
  }

  const fretCenterX = (fret: number) => (fretX(Math.max(0, fret - 1)) + fretX(fret)) / 2

  const lastX = fretX(spec.lastFret)
  const endX = lastX + (fretX(spec.lastFret + 1) - lastX) * spec.overhang

  const outline: Point[] = [
    { x: 0, y: -halfWidthAt(0) },
    { x: endX, y: -halfWidthAt(endX) },
    { x: endX, y: halfWidthAt(endX) },
    { x: 0, y: halfWidthAt(0) },
  ]

  const frets: FretLine[] = Array.from({ length: spec.lastFret }, (_, i) => {
    const n = i + 1
    const x = fretX(n)
    return { n, x, halfWidth: halfWidthAt(x) }
  })

  const startX = -spec.nutThickness - padding.left
  const strings: StringLine[] = tuning.strings.map((s, index) => ({
    index,
    from: { x: startX, y: stringY(index, startX) },
    to: { x: endX, y: stringY(index, endX) },
    gauge: s.gauge,
    wound: s.wound,
  }))

  // Espacement entre cordes voisines au plus serré (au sillet).
  const minSpacing = spec.stringSpreadNut / Math.max(1, stringCount - 1)
  const inlayOffset = minSpacing // double repère : une corde de part et d'autre du centre
  const inlays: InlayDot[] = spec.inlays
    .filter((i) => i.fret <= spec.lastFret)
    .flatMap(({ fret, double }) => {
      const cx = fretCenterX(fret)
      const r = spec.inlayDiameter / 2
      if (!double) return [{ fret, center: { x: cx, y: 0 }, r }]
      const dy = (inlayOffset * spreadAt(cx)) / spec.stringSpreadNut
      return [
        { fret, center: { x: cx, y: -dy }, r },
        { fret, center: { x: cx, y: dy }, r },
      ]
    })

  const maxHalf = halfWidthAt(endX)
  const nutHalf = halfWidthAt(0) + 0.4
  const top = -Math.max(maxHalf, nutHalf) - padding.top
  const bottom = Math.max(maxHalf, nutHalf) + padding.bottom
  const viewBox: Box = {
    x: startX,
    y: top,
    width: endX + padding.right - startX,
    height: bottom - top,
  }

  return {
    spec,
    tuning,
    highStringOnTop,
    viewBox,
    outline,
    nut: { x0: -spec.nutThickness, x1: 0, halfWidth: nutHalf },
    frets,
    strings,
    inlays,
    endX,
    markerRadius: minSpacing * 0.44,
    fretX,
    fretCenterX,
    stringY,
    position(stringIndex: number, fret: number): Point {
      const x = fretCenterX(fret)
      return { x, y: stringY(stringIndex, x) }
    },
  }
}
