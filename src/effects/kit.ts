import { useEffect, useRef } from 'react'

/**
 * Kit partagé des effets de révélation.
 *
 * Les presets y puisent leur typographie et leurs gabarits : un design system
 * restyle ici l'étiquette de note et la pastille de combo de tous les effets.
 */

/** Centre un élément sur le point d'ancrage de l'effet (le repère de note). */
export const REVEAL_CENTERED = 'absolute top-0 left-0 -translate-1/2'

/** Étiquette de note : pastille arrondie dont la taille suit `font-size`. */
export const REVEAL_PILL =
  'block rounded-full px-[0.7em] py-[0.38em] leading-none font-semibold whitespace-nowrap'

/** Pastille de combo « ×N », accrochée au coin haut-droit de l'étiquette. */
export const REVEAL_COMBO =
  'absolute top-0 left-full rounded-full px-[0.45em] py-[0.28em] text-[0.66em] leading-none font-bold whitespace-nowrap tabular-nums'

/** Série à partir de laquelle la pastille de combo apparaît. */
export const COMBO_MIN_STREAK = 3

/** La pastille de combo grossit avec la série, jusqu'à +40 %. */
export function comboScaleFor(streak: number): number {
  return 1 + 0.08 * Math.min(streak - COMBO_MIN_STREAK, 5)
}

/** Taille de police de l'étiquette (px), proportionnelle au repère et bornée. */
export function labelFontSize(markerSize: number): number {
  return Math.min(24, Math.max(13, markerSize * 0.75))
}

/** Appelle `onComplete` une seule fois après `ms`, robuste au double montage de StrictMode. */
export function useCompleteAfter(ms: number, onComplete: () => void): void {
  const callback = useRef(onComplete)
  const done = useRef(false)
  useEffect(() => {
    callback.current = onComplete
  })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (done.current) return
      done.current = true
      callback.current()
    }, ms)
    return () => window.clearTimeout(timer)
  }, [ms])
}
