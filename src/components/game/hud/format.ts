const SECONDS = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Durée en secondes, au dixième, à la française : `24300` → « 24,3 s ».
 * `ceil` sert au compte à rebours : « 0,0 s » ne s'affiche qu'à zéro pile.
 * (Afficher dans un élément `whitespace-nowrap` : l'espace avant l'unité est sécable.)
 */
export function formatSeconds(ms: number, rounding: 'round' | 'ceil' = 'round'): string {
  const tenths = rounding === 'ceil' ? Math.ceil(ms / 100) : Math.round(ms / 100)
  return SECONDS.format(Math.max(0, tenths) / 10) + ' s'
}
