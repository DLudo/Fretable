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
import { GhostDot } from './GhostDot'
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
  /** `assist` : note du coup de pouce, cerclée d'ambre ; `triad` : note d'une triade, en vert acide. */
  variant?: 'default' | 'assist' | 'triad'
}

/** Note à venir, montrée en filigrane (gris) : suite d'une triade, forme de gamme. */
export interface FretboardGhost {
  /** Clé stable (la position, en général) : une note qui reste ne réapparaît pas. */
  key: string
  stringIndex: number
  fret: number
  /** `triad` : nimbe vert acide léger, la note appartient à la triade en cours. */
  tone?: 'plain' | 'triad'
  /** Délai d'apparition (s), pour égrener les notes. */
  delay?: number
}

const NO_GHOSTS: readonly FretboardGhost[] = []

export interface FretboardProps {
  layout: NeckLayout
  /** Note à deviner ; `null` = pas de point (une révélation se joue à cet endroit). */
  marker: FretboardMarker | null
  /** Notes à venir, en filigrane, sous la note à deviner. */
  ghosts?: readonly FretboardGhost[]
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
  ghosts = NO_GHOSTS,
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
  const triadGlowId = `${uid}-triad-glow`

  // Repères recouverts par le point ou par les notes en filigrane : estompés,
  // puis rétablis quand ils repartent. La clé ne change qu'avec les positions.
  const spots = [
    ...(marker ? [`${marker.stringIndex}:${marker.fret}`] : []),
    ...ghosts.map((ghost) => `${ghost.stringIndex}:${ghost.fret}`),
  ].join(' ')
  const covered = useMemo(() => {
    if (!spots) return NO_INLAY
    const ids = new Set<string>()
    for (const spot of spots.split(' ')) {
      const [s, f] = spot.split(':').map(Number)
      const point = layout.position(s, f)
      for (const inlay of inlaysUnder(layout.inlays, point, layout.markerRadius)) ids.add(inlay.id)
    }
    return ids.size > 0 ? [...ids] : NO_INLAY
  }, [layout, spots])

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
            <radialGradient id={triadGlowId}>
              <stop offset={0.25} style={{ stopColor: 'var(--triad-glow)', stopOpacity: 1 }} />
              <stop offset={1} style={{ stopColor: 'var(--triad-glow)', stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <g data-slot="fretboard-ghosts">
            <AnimatePresence>
              {ghosts.map((ghost) => {
                const at = layout.position(ghost.stringIndex, ghost.fret)
                return (
                  <GhostDot
                    key={ghost.key}
                    cx={at.x}
                    cy={at.y}
                    r={layout.markerRadius}
                    triadGlowId={ghost.tone === 'triad' ? triadGlowId : undefined}
                    delay={ghost.delay}
                    reduceMotion={reduceMotion}
                  />
                )
              })}
            </AnimatePresence>
          </g>
          <AnimatePresence>
            {marker && position && (
              <MarkerDot
                key={marker.id}
                cx={position.x}
                cy={position.y}
                r={layout.markerRadius}
                haloId={haloId}
                triadGlowId={triadGlowId}
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
