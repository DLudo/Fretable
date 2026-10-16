import { memo } from 'react'

import type { NeckLayout } from '@/game/fretboard/geometry'

/** Écart entre le bord de la touche et les chiffres (mm). */
const GAP_MM = 1.4
/** Opacité des numéros sans repère ; la hiérarchie tient surtout à la graisse. */
const UNMARKED_OPACITY = 0.75

interface FretNumbersProps {
  layout: NeckLayout
  /** Corps du texte visé, en mm (ajusté par le parent pour rester lisible à l'écran). */
  fontSize: number
}

/**
 * Numéros de cases, centrés sur chaque case et alignés sous le manche ; les
 * cases à repère sont accentuées.
 */
export const FretNumbers = memo(function FretNumbers({ layout, fontSize }: FretNumbersProps) {
  const marked = new Set(layout.spec.inlays.map((i) => i.fret))
  // Bord bas du cadre : la marge des numéros.
  const outer = layout.viewBox.y + layout.viewBox.height

  return (
    <g
      data-slot="fretboard-fret-numbers"
      aria-hidden
      className="fill-fret-number tabular-nums select-none"
      fontSize={fontSize}
      textAnchor="middle"
    >
      {layout.frets.map(({ n }) => {
        const x = layout.fretCenterX(n)
        const edge = layout.halfWidthAt(x) + GAP_MM
        const strong = marked.has(n)
        return (
          <text
            key={n}
            data-slot="fretboard-fret-number"
            data-marked={strong || undefined}
            x={x}
            y={Math.min(edge + fontSize * 0.5, outer - fontSize * 0.5)}
            dominantBaseline="central"
            fontWeight={strong ? 600 : 400}
            fillOpacity={strong ? 1 : UNMARKED_OPACITY}
          >
            {n}
          </text>
        )
      })}
    </g>
  )
})
