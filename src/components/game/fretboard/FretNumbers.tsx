import { memo } from 'react'

import type { NeckLayout } from '@/game/fretboard/geometry'

/** Écart entre le bord de la touche et le haut des chiffres (mm). */
const GAP_MM = 1.4

interface FretNumbersProps {
  layout: NeckLayout
  /** Corps du texte en mm (ajusté par le parent pour rester lisible à l'écran). */
  fontSize: number
}

/** Numéros de cases sous le manche ; les cases à repère sont accentuées. */
export const FretNumbers = memo(function FretNumbers({ layout, fontSize }: FretNumbersProps) {
  const marked = new Set(layout.spec.inlays.map((i) => i.fret))
  const [, , bottomRight, bottomLeft] = layout.outline
  const bottomAt = (x: number) =>
    bottomLeft.y + ((bottomRight.y - bottomLeft.y) * (x - bottomLeft.x)) / (bottomRight.x - bottomLeft.x)
  const limit = layout.viewBox.y + layout.viewBox.height - fontSize * 0.5

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
        const strong = marked.has(n)
        return (
          <text
            key={n}
            data-slot="fretboard-fret-number"
            data-marked={strong || undefined}
            x={x}
            y={Math.min(bottomAt(x) + GAP_MM + fontSize * 0.5, limit)}
            dominantBaseline="central"
            fontWeight={strong ? 600 : 400}
            fillOpacity={strong ? 1 : 0.6}
          >
            {n}
          </text>
        )
      })}
    </g>
  )
})
