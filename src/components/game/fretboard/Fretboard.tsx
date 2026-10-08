import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useId, useMemo, type ReactNode } from 'react'

import { inlaysUnder, type NeckLayout } from '@/game/fretboard/geometry'
import {
  createProjection,
  ORIENTATION_TRANSFORM,
  orientViewBox,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { stringNumber } from '@/game/music/tuning'
import { useElementSize } from '@/hooks/useElementSize'
import { cn } from '@/lib/utils'
import { FretNumbers } from './FretNumbers'
import { CoveredInlaysContext } from './inlay-context'
import { MarkerDot } from './MarkerDot'
import { NeckBoard } from './NeckBoard'

/** Note à deviner, affichée par un point sur le manche. */
export interface FretboardMarker {
  /** Identifiant de la note : un nouvel identifiant rejoue l'apparition. */
  id: number
  /** Index de corde (0 = Mi grave). */
  stringIndex: number
  /** Case (1 à 12). */
  fret: number
  /** `assist` : note du coup de pouce, cerclée d'ambre. */
  variant?: 'default' | 'assist'
}

export interface FretboardProps {
  layout: NeckLayout
  /** Note à deviner ; `null` = pas de point (une révélation se joue à cet endroit). */
  marker: FretboardMarker | null
  /** Calque HTML posé au-dessus du manche, en px ; reçoit la projection mm → px. */
  overlay?: (projection: BoardProjection) => ReactNode
  /** Numéros de cases le long du manche (défaut : `true`). */
  showFretNumbers?: boolean
  /** Orientation d'affichage (défaut : `horizontal`). */
  orientation?: BoardOrientation
  className?: string
}

/** Taille visée des numéros de cases à l'écran (px), bornée en mm pour tenir dans la marge. */
const FRET_NUMBER_PX = 11
const FRET_NUMBER_MM = { min: 3, max: 8 }

/** Aucun repère recouvert (référence stable : le calque des repères ne se redessine pas). */
const NO_INLAY: readonly string[] = []

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Manche de guitare réaliste (cases 1 à 12), dessiné en millimètres et mis à
 * l'échelle par le navigateur. À la verticale, le dessin pivote d'un quart de
 * tour (sillet en haut) et les numéros de cases restent droits. Le calque
 * `overlay` reçoit la projection mm → px, orientation comprise, pour y placer
 * des éléments HTML exactement sur le manche.
 */
export function Fretboard({
  layout,
  marker,
  overlay,
  showFretNumbers = true,
  orientation = 'horizontal',
  className,
}: FretboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const reduceMotion = useReducedMotion() ?? false
  const [svgRef, size] = useElementSize<SVGSVGElement>()
  const vb = layout.viewBox
  const box = orientViewBox(vb, orientation)

  const projection = useMemo(
    () =>
      createProjection(
        { x: vb.x, y: vb.y, width: vb.width, height: vb.height },
        size.width,
        size.height,
        orientation,
      ),
    [vb.x, vb.y, vb.width, vb.height, size.width, size.height, orientation],
  )

  // Arrondi au quart de mm : les numéros ne se redessinent qu'à des paliers de taille.
  const fretNumberSize =
    projection.pxPerMm > 0
      ? Math.round(
          clamp(FRET_NUMBER_PX / projection.pxPerMm, FRET_NUMBER_MM.min, FRET_NUMBER_MM.max) * 4,
        ) / 4
      : FRET_NUMBER_MM.min

  const position = marker ? layout.position(marker.stringIndex, marker.fret) : null
  const haloId = `${uid}-marker-halo`

  // Repères recouverts par le point : estompés, puis rétablis quand le point repart.
  const stringIndex = marker?.stringIndex
  const fret = marker?.fret
  const covered = useMemo(() => {
    if (stringIndex === undefined || fret === undefined) return NO_INLAY
    const point = layout.position(stringIndex, fret)
    const ids = inlaysUnder(layout.inlays, point, layout.markerRadius).map((inlay) => inlay.id)
    return ids.length > 0 ? ids : NO_INLAY
  }, [layout, stringIndex, fret])

  return (
    <div
      data-slot="fretboard"
      data-orientation={orientation}
      className={cn('relative w-full', className)}
    >
      <svg
        ref={svgRef}
        data-slot="fretboard-svg"
        role="img"
        aria-label="Manche de guitare, cases 1 à 12"
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        style={{ aspectRatio: box.width / box.height }}
      >
        {/* Hors du groupe orienté : les chiffres restent droits dans les deux sens. */}
        {showFretNumbers && (
          <FretNumbers layout={layout} fontSize={fretNumberSize} orientation={orientation} />
        )}
        <g transform={ORIENTATION_TRANSFORM[orientation]}>
          <CoveredInlaysContext value={covered}>
            <NeckBoard layout={layout} uid={uid} />
          </CoveredInlaysContext>
          <defs>
            <radialGradient id={haloId}>
              <stop offset={0.45} style={{ stopColor: 'var(--marker-halo)', stopOpacity: 1 }} />
              <stop offset={1} style={{ stopColor: 'var(--marker-halo)', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <AnimatePresence>
            {marker && position && (
              <MarkerDot
                key={marker.id}
                cx={position.x}
                cy={position.y}
                r={layout.markerRadius}
                haloId={haloId}
                variant={marker.variant}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>
        </g>
      </svg>

      {overlay && size.width > 0 && (
        <div
          data-slot="fretboard-overlay"
          className="pointer-events-none absolute inset-0 overflow-visible"
        >
          {overlay(projection)}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {marker
          ? `Note à trouver : corde ${stringNumber(layout.tuning, marker.stringIndex)}, case ${marker.fret}`
          : ''}
      </p>
    </div>
  )
}
