import { memo, use, type CSSProperties } from 'react'

import type { InlayDot } from '@/game/fretboard/geometry'
import { duration, ease } from '@/theme/motion'
import { CoveredInlaysContext } from './inlay-context'

/** Estompage d'un repère sous le point, et retour quand le point repart. */
const INLAY_FADE: CSSProperties = {
  transitionProperty: 'opacity',
  transitionDuration: `${duration.fast}s`,
  transitionTimingFunction: `cubic-bezier(${ease.outQuart.join(', ')})`,
}

interface NeckInlaysProps {
  inlays: readonly InlayDot[]
  /** Identifiant du dégradé de reflet (défini par `NeckBoard`). */
  sheenId: string
}

/**
 * Repères de touche. Ceux que recouvre le point à deviner portent
 * `data-state="covered"` et s'estompent : aucun disque gris ne dépasse du point.
 */
export const NeckInlays = memo(function NeckInlays({ inlays, sheenId }: NeckInlaysProps) {
  const covered = use(CoveredInlaysContext)

  return (
    <g data-slot="fretboard-inlays">
      {inlays.map(({ id, fret, center, r }) => (
        <g
          key={id}
          data-slot="fretboard-inlay"
          data-inlay={id}
          data-fret={fret}
          data-state={covered.includes(id) ? 'covered' : undefined}
          className="data-[state=covered]:opacity-25"
          style={INLAY_FADE}
        >
          <circle
            cx={center.x}
            cy={center.y}
            r={r}
            className="fill-inlay stroke-fretboard-edge"
            strokeWidth={0.3}
          />
          <circle cx={center.x} cy={center.y} r={r} fill={`url(#${sheenId})`} />
        </g>
      ))}
    </g>
  )
})
