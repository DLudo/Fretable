import { memo } from 'react'

import type { NeckLayout } from '@/game/fretboard/geometry'
import { orientPoint, type BoardOrientation } from '@/game/fretboard/projection'

/** Écart entre le bord de la touche et les chiffres (mm). */
const GAP_MM = 1.4
/** Chasse d'un chiffre en gras (em, chiffres tabulaires) : sert à caler « 12 » dans la marge. */
const DIGIT_EM = 0.65
/** Opacité des numéros sans repère ; la hiérarchie tient surtout à la graisse. */
const UNMARKED_OPACITY = 0.75

interface FretNumbersProps {
  layout: NeckLayout
  /** Corps du texte visé, en mm (ajusté par le parent pour rester lisible à l'écran). */
  fontSize: number
  /** À rendre hors du groupe orienté : les chiffres restent toujours droits. */
  orientation: BoardOrientation
}

/**
 * Numéros de cases, centrés sur chaque case ; les cases à repère sont accentuées.
 * À l'horizontale, ils s'alignent sous le manche ; à la verticale, ils se
 * calent à gauche, contre le bord de la touche (côté corde grave).
 */
export const FretNumbers = memo(function FretNumbers({
  layout,
  fontSize: requested,
  orientation,
}: FretNumbersProps) {
  const marked = new Set(layout.spec.inlays.map((i) => i.fret))
  const vertical = orientation === 'vertical'
  // Bord du cadre côté numéros (marge basse du manche horizontal).
  const outer = layout.viewBox.y + layout.viewBox.height
  // À la verticale, le numéro le plus long doit tenir en largeur dans la marge la plus étroite.
  const lastFret = layout.spec.lastFret
  const narrowest = outer - layout.halfWidthAt(layout.fretCenterX(lastFret)) - GAP_MM
  const fontSize = vertical
    ? Math.min(requested, narrowest / (String(lastFret).length * DIGIT_EM))
    : requested

  return (
    <g
      data-slot="fretboard-fret-numbers"
      data-orientation={orientation}
      aria-hidden
      className="fill-fret-number tabular-nums select-none"
      fontSize={fontSize}
      textAnchor={vertical ? 'end' : 'middle'}
    >
      {layout.frets.map(({ n }) => {
        const x = layout.fretCenterX(n)
        const edge = layout.halfWidthAt(x) + GAP_MM
        const anchor = orientPoint(
          { x, y: vertical ? edge : Math.min(edge + fontSize * 0.5, outer - fontSize * 0.5) },
          orientation,
        )
        const strong = marked.has(n)
        return (
          <text
            key={n}
            data-slot="fretboard-fret-number"
            data-marked={strong || undefined}
            x={anchor.x}
            y={anchor.y}
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
