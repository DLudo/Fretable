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
 * Précision d'une durée affichée : `auto` donne le dixième sous la minute et
 * des secondes entières au-delà ; `tenths` et `seconds` l'imposent.
 */
export type ClockResolution = 'auto' | 'tenths' | 'seconds'

/** Précision de l'affichage `auto` d'une durée : celle du minuteur du HUD. */
export function clockResolutionOf(
  ms: number,
  rounding: SecondsRounding = 'round',
): Exclude<ClockResolution, 'auto'> {
  return Math[rounding](Math.max(0, ms) / 100) < 600 ? 'tenths' : 'seconds'
}

/**
 * Durée lisible d'un coup d'œil : en deçà d'une minute, au dixième (« 59,9 s ») ;
 * au-delà, en minutes et secondes entières (« 1:59 »). Une précision imposée
 * donne « 1:05,4 » (dixièmes) ou « 45 s » (secondes) : utile pour qu'un
 * chronomètre et un compte à rebours de même précision totalisent la durée.
 */
export function formatClock(
  ms: number,
  rounding: SecondsRounding = 'round',
  resolution: ClockResolution = 'auto',
): string {
  const value = Math.max(0, ms)
  const unit = resolution === 'auto' ? clockResolutionOf(value, rounding) : resolution
  if (unit === 'tenths') {
    const tenths = Math[rounding](value / 100)
    if (tenths < 600) return formatSeconds(value, rounding)
    const minutes = Math.floor(tenths / 600)
    const rest = tenths - minutes * 600
    return `${minutes}:${String(Math.floor(rest / 10)).padStart(2, '0')},${rest % 10}`
  }
  const seconds = Math[rounding](value / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * La même durée, à lire : « 1 minute 59 secondes » au-delà d'une minute (le
 * format « 1:59 » se prononce mal), sinon comme `formatClock`.
 */
export function formatClockSpoken(ms: number, rounding: SecondsRounding = 'round'): string {
  if (clockResolutionOf(ms, rounding) === 'tenths') return formatClock(ms, rounding)
  const seconds = Math[rounding](Math.max(0, ms) / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  const minuteText = `${minutes} minute${minutes > 1 ? 's' : ''}`
  return rest === 0 ? minuteText : `${minuteText} ${rest} seconde${rest > 1 ? 's' : ''}`
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
