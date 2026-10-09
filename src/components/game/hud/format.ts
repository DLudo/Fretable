const SECONDS = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Arrondi au dixième de seconde :
 * - `round` : au plus proche (valeur neutre) ;
 * - `ceil` : compte à rebours, « 0,0 s » ne s'affiche qu'à zéro pile ;
 * - `floor` : chronomètre, tronqué. Avec un compte à rebours en `ceil` sur la
 *   même échéance, les deux affichages totalisent toujours la durée exacte.
 */
export type SecondsRounding = 'round' | 'ceil' | 'floor'

/**
 * Durée en secondes, au dixième, à la française : `24300` → « 24,3 s ».
 * Les durées négatives valent zéro.
 * (Afficher dans un élément `whitespace-nowrap` : l'espace avant l'unité est sécable.)
 */
export function formatSeconds(ms: number, rounding: SecondsRounding = 'round'): string {
  const tenths = Math[rounding](ms / 100)
  return SECONDS.format(Math.max(0, tenths) / 10) + ' s'
}

/**
 * Durée lisible d'un coup d'œil : en deçà d'une minute, au dixième (« 59,9 s ») ;
 * au-delà, en minutes et secondes entières (« 1:59 »). Même arrondi que
 * `formatSeconds`, appliqué aux secondes au-delà d'une minute.
 */
export function formatClock(ms: number, rounding: SecondsRounding = 'round'): string {
  const value = Math.max(0, ms)
  if (Math[rounding](value / 100) < 600) return formatSeconds(value, rounding)
  const seconds = Math[rounding](value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Durée en toutes lettres pour une consigne : « 2 minutes », « 90 secondes ». */
export function formatDurationWords(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60
    return `${minutes} minute${minutes > 1 ? 's' : ''}`
  }
  return `${seconds} seconde${seconds > 1 ? 's' : ''}`
}

const POINTS = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** Score à la française, milliers séparés : `12400` → « 12 400 ». */
export function formatScore(points: number): string {
  return POINTS.format(Math.max(0, Math.round(points)))
}
