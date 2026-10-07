import type { ComponentType } from 'react'

export type RevealOutcome = 'correct' | 'wrong'

/**
 * Contrat d'un effet de révélation.
 *
 * Un effet est un composant React autonome, monté en position absolue au-dessus
 * du manche, centré sur le repère de la note (`x`, `y` en px, origine = coin
 * haut-gauche du calque d'effets). Il est libre de sa technique : Motion, CSS,
 * canvas, Rive, Lottie… La seule obligation est d'appeler `onComplete` une fois
 * terminé pour être démonté.
 */
export interface RevealEffectProps {
  /** Identifiant unique de la révélation. */
  id: number
  outcome: RevealOutcome
  /** Nom de la note à révéler (ex. « Sol♯ »). */
  label: string
  /** Centre du repère, en px dans le calque d'effets. */
  x: number
  y: number
  /** Diamètre du repère à l'écran, en px : échelle de référence de l'effet. */
  markerSize: number
  /** Px par millimètre de manche, pour les effets qui veulent épouser la géométrie. */
  pxPerMm: number
  /** Direction de la corde à l'écran (radians), pour les effets « le long de la corde ». */
  stringAngle: number
  /** 0 → 1 : monte avec la série de bonnes réponses. Toujours 0 sur une erreur. */
  intensity: number
  /** Série en cours (tentative incluse). */
  streak: number
  /** Graine déterministe propre à la révélation, pour varier les détails. */
  seed: number
  /** Couleur de feedback (variable CSS) : succès ou erreur. */
  color: string
  /** Couleur de texte lisible sur `color`. */
  colorForeground: string
  /** À appeler quand l'effet a fini de jouer. */
  onComplete: () => void
}

export interface RevealEffect {
  /** Identifiant stable (kebab-case). */
  id: string
  /** Nom lisible, pour le débogage et une future galerie d'effets. */
  name: string
  /** Issues prises en charge. */
  outcomes: readonly RevealOutcome[]
  /** Poids relatif dans le tirage (1 par défaut). */
  weight?: number
  Component: ComponentType<RevealEffectProps>
}
