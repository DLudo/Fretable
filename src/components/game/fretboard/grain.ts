import { range, seededRandom } from '@/effects/random'
import type { NeckLayout } from '@/game/fretboard/geometry'

/** Une fibre du bois : tracé (mm) et réglages de rendu. */
export interface GrainFiber {
  d: string
  width: number
  opacity: number
  /** Fibre sombre (veine) plutôt que claire. */
  dark: boolean
}

export interface Grain {
  fibers: GrainFiber[]
  /** Pores : courts traits sombres semés le long du fil, réunis en un seul tracé. */
  pores: string
}

const STEP_MM = 4

/**
 * Veinage déterministe de la touche : longues fibres à peine ondulées qui
 * suivent l'évasement du manche. Même graine → même bois à chaque rendu.
 */
export function createGrain(
  layout: NeckLayout,
  seed = 0x0f12e7,
  count = 38,
  poreCount = 260,
): Grain {
  const random = seededRandom(seed)
  const [topLeft, topRight] = layout.outline
  const { endX } = layout
  const halfWidthAt = (x: number) => -(topLeft.y + ((topRight.y - topLeft.y) * x) / endX)

  const fibers = Array.from({ length: count }, (_, i): GrainFiber => {
    // Répartition stratifiée sur la largeur, pour un veinage régulier sans paquets.
    const lane = -0.98 + (1.96 * (i + range(random, 0.15, 0.85))) / count
    const ripple = {
      a: range(random, 0.06, 0.32),
      k: (2 * Math.PI) / range(random, 28, 90),
      p: range(random, 0, 7),
    }
    const drift = {
      a: range(random, 0.2, 0.9),
      k: (2 * Math.PI) / range(random, 160, 420),
      p: range(random, 0, 7),
    }
    const partial = random() < 0.35
    const start = partial ? range(random, -2, endX * 0.6) : -2
    const end = partial ? Math.min(endX + 2, start + range(random, 60, 220)) : endX + 2

    const points: string[] = []
    for (let x = start; x <= end + STEP_MM / 2; x += STEP_MM) {
      const cx = Math.min(x, end)
      const y =
        lane * halfWidthAt(cx) +
        ripple.a * Math.sin(ripple.k * cx + ripple.p) +
        drift.a * Math.sin(drift.k * cx + drift.p)
      points.push(`${cx.toFixed(1)} ${y.toFixed(2)}`)
    }

    const dark = random() < 0.3
    return {
      d: `M${points.join('L')}`,
      width: range(random, 0.12, dark ? 0.32 : 0.5),
      opacity: range(random, dark ? 0.3 : 0.35, dark ? 0.65 : 0.85),
      dark,
    }
  })

  const pores = Array.from({ length: poreCount }, () => {
    const x = range(random, 0, endX)
    const y = range(random, -0.97, 0.97) * halfWidthAt(x)
    return `M${x.toFixed(1)} ${y.toFixed(2)}h${range(random, 0.6, 3.2).toFixed(1)}`
  }).join('')

  return { fibers, pores }
}
