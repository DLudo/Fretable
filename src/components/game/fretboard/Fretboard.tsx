import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { NeckLayout } from '@/game/fretboard/geometry'
import {
  createProjection,
  ORIENTATION_TRANSFORM,
  orientViewBox,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { stringNumber } from '@/game/music/tuning'
import { cn } from '@/lib/utils'
import { FretNumbers } from './FretNumbers'
import { MarkerDot } from './MarkerDot'
import { NeckBoard } from './NeckBoard'

export interface FretboardMarker {
  id: number
  stringIndex: number
  fret: number
}

export interface FretboardProps {
  layout: NeckLayout
  /** Note to guess; null = no dot (a reveal effect is playing at that spot). */
  marker: FretboardMarker | null
  /** Overlay rendered above the board, in px; receives the mm→px projection. */
  overlay?: (projection: BoardProjection) => ReactNode
  /** Fret numbers under the neck (default true). */
  showFretNumbers?: boolean
  /** Orientation d'affichage (défaut : horizontal). */
  orientation?: BoardOrientation
  className?: string
}

/** Taille visée des numéros de cases à l'écran (px), bornée en mm pour tenir sous le manche. */
const FRET_NUMBER_PX = 11
const FRET_NUMBER_MM = { min: 3, max: 8 }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

interface Size {
  width: number
  height: number
}

/** Boîte rendue d'un élément, mise à jour par ResizeObserver (aucun rendu si inchangée). */
function useBoxSize<T extends Element>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = (width: number, height: number) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    const rect = element.getBoundingClientRect()
    update(rect.width, rect.height)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

/**
 * Manche de guitare réaliste (cases 1 à 12), dessiné en millimètres et mis à
 * l'échelle par le navigateur. Le calque `overlay` reçoit la projection mm → px
 * pour y placer des éléments HTML exactement sur le manche.
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
  const [svgRef, size] = useBoxSize<SVGSVGElement>()
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

  return (
    <div data-slot="fretboard" className={cn('relative w-full', className)}>
      <svg
        ref={svgRef}
        role="img"
        aria-label="Manche de guitare, cases 1 à 12"
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        style={{ aspectRatio: box.width / box.height }}
      >
        <g transform={ORIENTATION_TRANSFORM[orientation]}>
          <NeckBoard layout={layout} uid={uid} />
          {showFretNumbers && <FretNumbers layout={layout} fontSize={fretNumberSize} />}
          <defs>
            <radialGradient id={haloId}>
              <stop offset={0.45} style={{ stopColor: 'var(--marker-ring)', stopOpacity: 1 }} />
              <stop offset={1} style={{ stopColor: 'var(--marker-ring)', stopOpacity: 0 }} />
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
