import { memo, useMemo } from 'react'

import type { NeckLayout } from '@/game/fretboard/geometry'
import { createGrain } from './grain'

/** Longueur du fondu à l'extrémité droite (mm) : le manche semble continuer. */
const FADE_MM = 8
/** Décalage de l'ombre portée des cordes (mm), lumière venant du haut. */
const STRING_SHADOW_MM = 0.5
/** Pas de la texture de filage des cordes filées (mm). */
const WINDING_DASH = '0.32 0.3'

interface NeckBoardProps {
  layout: NeckLayout
  /** Préfixe unique des identifiants SVG (dégradés, masques). */
  uid: string
}

/**
 * Partie statique du manche : bois, sillet, frettes, repères, cordes.
 * Mémoïsée : seul un changement de `layout` la redessine.
 */
export const NeckBoard = memo(function NeckBoard({ layout, uid }: NeckBoardProps) {
  const { outline, nut, frets, strings, inlays, endX, spec, viewBox: vb } = layout
  const grain = useMemo(() => createGrain(layout), [layout])
  const points = outline.map((p) => `${p.x},${p.y}`).join(' ')
  const [topLeft, topRight, bottomRight, bottomLeft] = outline
  const id = {
    clip: `${uid}-wood-clip`,
    fade: `${uid}-fade`,
    fadeGradient: `${uid}-fade-gradient`,
    radius: `${uid}-radius`,
    nutShade: `${uid}-nut-shade`,
    crown: `${uid}-crown`,
    sheen: `${uid}-sheen`,
  }
  const wire = spec.fretWireWidth

  return (
    <>
      <defs>
        <clipPath id={id.clip}>
          <polygon points={points} />
        </clipPath>
        <linearGradient
          id={id.fadeGradient}
          gradientUnits="userSpaceOnUse"
          x1={endX - FADE_MM}
          x2={endX}
          y1={0}
          y2={0}
        >
          {/* Courbe concave : les cordes, très claires, s'éteignent sans effet de coupe. */}
          <stop offset={0} stopOpacity={1} />
          <stop offset={0.3} stopOpacity={0.5} />
          <stop offset={0.6} stopOpacity={0.18} />
          <stop offset={0.85} stopOpacity={0.04} />
          <stop offset={1} stopOpacity={0} />
        </linearGradient>
        <mask
          id={id.fade}
          maskUnits="userSpaceOnUse"
          x={vb.x}
          y={vb.y}
          width={vb.width}
          height={vb.height}
          style={{ maskType: 'alpha' }}
        >
          <rect
            x={vb.x}
            y={vb.y}
            width={vb.width}
            height={vb.height}
            fill={`url(#${id.fadeGradient})`}
          />
        </mask>
        {/* Bombé de la touche : bords assombris, centre neutre. */}
        <linearGradient id={id.radius} x1={0} x2={0} y1={0} y2={1}>
          <stop offset={0} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0.85 }} />
          <stop offset={0.16} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0 }} />
          <stop offset={0.84} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0 }} />
          <stop offset={1} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0.9 }} />
        </linearGradient>
        <linearGradient id={id.nutShade} x1={0} x2={1} y1={0} y2={0}>
          <stop offset={0} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0.35 }} />
          <stop offset={0.4} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0 }} />
          <stop offset={0.75} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0 }} />
          <stop offset={1} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0.3 }} />
        </linearGradient>
        {/* Profil arrondi du fil de frette. */}
        <linearGradient id={id.crown} x1={0} x2={1} y1={0} y2={0}>
          <stop offset={0} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0.45 }} />
          <stop offset={0.42} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0 }} />
          <stop offset={0.62} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0 }} />
          <stop offset={1} style={{ stopColor: 'var(--fretboard-edge)', stopOpacity: 0.6 }} />
        </linearGradient>
        <radialGradient id={id.sheen} cx={0.36} cy={0.32} r={0.7}>
          <stop offset={0} style={{ stopColor: 'var(--fret-wire-highlight)', stopOpacity: 0.28 }} />
          <stop offset={1} style={{ stopColor: 'var(--fret-wire-highlight)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <g mask={`url(#${id.fade})`}>
        <g data-slot="fretboard-wood">
          <polygon points={points} className="fill-fretboard" />
          <g clipPath={`url(#${id.clip})`}>
            {grain.fibers.map((fiber, i) => (
              <path
                key={i}
                d={fiber.d}
                fill="none"
                className={fiber.dark ? 'stroke-fretboard-edge' : 'stroke-fretboard-grain'}
                strokeWidth={fiber.width}
                strokeOpacity={fiber.opacity}
                strokeLinecap="round"
              />
            ))}
            <path
              d={grain.pores}
              fill="none"
              className="stroke-fretboard-edge"
              strokeWidth={0.28}
              strokeOpacity={0.5}
              strokeLinecap="round"
            />
            <rect
              x={0}
              y={topRight.y}
              width={endX}
              height={bottomRight.y - topRight.y}
              fill={`url(#${id.radius})`}
            />
          </g>
          {/* Arêtes du manche. */}
          <path
            d={`M${topLeft.x} ${topLeft.y}L${topRight.x} ${topRight.y}M${bottomLeft.x} ${bottomLeft.y}L${bottomRight.x} ${bottomRight.y}`}
            className="stroke-fretboard-edge"
            strokeWidth={0.9}
            fill="none"
          />
        </g>

        <g data-slot="fretboard-inlays">
          {inlays.map(({ fret, center, r }) => (
            <g key={`${fret}-${center.y}`} data-slot="fretboard-inlay" data-fret={fret}>
              <circle
                cx={center.x}
                cy={center.y}
                r={r}
                className="fill-inlay stroke-fretboard-edge"
                strokeWidth={0.3}
              />
              <circle cx={center.x} cy={center.y} r={r} fill={`url(#${id.sheen})`} />
            </g>
          ))}
        </g>

        <g data-slot="fretboard-frets">
          {frets.map(({ n, x, halfWidth }) => (
            <g key={n} data-slot="fretboard-fret" data-fret={n}>
              {/* Ombre portée côté chevalet. */}
              <rect
                x={x}
                y={-halfWidth}
                width={wire / 2 + 0.9}
                height={halfWidth * 2}
                className="fill-fretboard-edge"
                fillOpacity={0.75}
              />
              <rect
                x={x - wire / 2}
                y={-halfWidth}
                width={wire}
                height={halfWidth * 2}
                rx={wire * 0.4}
                className="fill-fret-wire"
              />
              <rect
                x={x - wire / 2}
                y={-halfWidth}
                width={wire}
                height={halfWidth * 2}
                rx={wire * 0.4}
                fill={`url(#${id.crown})`}
              />
              {/* Reflet sur la couronne. */}
              <rect
                x={x - wire * 0.2}
                y={-halfWidth + 0.7}
                width={wire * 0.2}
                height={halfWidth * 2 - 1.4}
                rx={wire * 0.1}
                className="fill-fret-wire-highlight"
                fillOpacity={0.7}
              />
            </g>
          ))}
        </g>

        <g data-slot="fretboard-nut">
          <rect
            x={nut.x0}
            y={-nut.halfWidth}
            width={nut.x1 - nut.x0}
            height={nut.halfWidth * 2}
            rx={0.9}
            className="fill-nut"
          />
          <rect
            x={nut.x0}
            y={-nut.halfWidth}
            width={nut.x1 - nut.x0}
            height={nut.halfWidth * 2}
            rx={0.9}
            fill={`url(#${id.nutShade})`}
          />
          <rect
            x={nut.x0 + 0.9}
            y={-nut.halfWidth + 0.6}
            width={0.5}
            height={nut.halfWidth * 2 - 1.2}
            rx={0.25}
            className="fill-fret-wire-highlight"
            fillOpacity={0.6}
          />
        </g>

        <g data-slot="fretboard-strings">
          {strings.map((s) => (
            <line
              key={s.index}
              x1={s.from.x}
              y1={s.from.y + STRING_SHADOW_MM}
              x2={s.to.x}
              y2={s.to.y + STRING_SHADOW_MM}
              className="stroke-fretboard-edge"
              strokeWidth={s.gauge * 1.15}
              strokeOpacity={0.9}
            />
          ))}
          {strings.map((s) => {
            const tone = s.wound ? 'stroke-string-wound' : 'stroke-string'
            const line = { x1: s.from.x, y1: s.from.y, x2: s.to.x, y2: s.to.y }
            return (
              <g key={s.index} data-slot="fretboard-string" data-string={s.index}>
                {/* Plancher d'un pixel écran : la Mi aiguë reste visible à toute taille. */}
                <line
                  {...line}
                  className={tone}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <line {...line} className={tone} strokeWidth={s.gauge} />
                {s.wound && (
                  <line
                    {...line}
                    className="stroke-fretboard-edge"
                    strokeWidth={s.gauge}
                    strokeDasharray={WINDING_DASH}
                    strokeOpacity={0.4}
                  />
                )}
                <line
                  x1={s.from.x}
                  y1={s.from.y - s.gauge * 0.2}
                  x2={s.to.x}
                  y2={s.to.y - s.gauge * 0.2}
                  className="stroke-fret-wire-highlight"
                  strokeWidth={s.gauge * 0.3}
                  strokeOpacity={0.55}
                />
              </g>
            )
          })}
        </g>
      </g>
    </>
  )
})
