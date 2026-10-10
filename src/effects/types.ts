import type { ComponentType } from 'react'

import type { PitchClass } from '@/game/music/notes'

export type RevealOutcome = 'correct' | 'wrong'

/**
 * Contrat d'un effet de révélation.
 *
 * Un effet est un composant React autonome, monté en position absolue au-dessus
 * du manche, centré sur le repère de la note (`x`, `y` en px, origine = coin
 * haut-gauche du calque d'effets). Il est libre de sa technique : Motion, CSS,
 * canvas, Rive, Lottie… La seule obligation est d'appeler `onComplete` une fois
 * terminé pour être démonté. Le kit (`./kit`) fournit étiquette, combo, calendrier
 * de sortie et conversion des couleurs.
 *
 * Couleurs : `color`, `colorForeground` et `highlight` sont des expressions de
 * couleur CSS (`var(--…)`), directement utilisables en style, SVG ou classes.
 * Pour un canvas, Rive ou Lottie, `resolveCssColor(élément, couleur)` (kit) renvoie
 * la valeur calculée et ses composantes sRGB `[r, g, b, a]`.
 */
export interface RevealEffectProps {
  /** Identifiant unique de la révélation (= id du défi). Sans rapport avec `RevealEffect.id`. */
  revealId: number
  /** Issue : `wrong` couvre aussi le temps écoulé (voir `timedOut`). */
  outcome: RevealOutcome
  /** Bonne note, celle à révéler. */
  pc: PitchClass
  /** Note jouée ; `null` si le temps s'est écoulé avant toute réponse. */
  guess: PitchClass | null
  /** Révélation faute de réponse (fin du temps imparti) : `guess` vaut `null`. */
  timedOut: boolean
  /** Nom de la note à révéler (ex. « Sol♯ »). */
  label: string
  /** Corde (0 = Mi grave) et case de la note. */
  stringIndex: number
  fret: number
  /** Centre du repère, en px dans le calque d'effets. */
  x: number
  y: number
  /** Diamètre du repère à l'écran, en px : échelle de référence de l'effet. */
  markerSize: number
  /** Px par millimètre de manche, pour les effets qui veulent épouser la géométrie. */
  pxPerMm: number
  /** Direction de la corde à l'écran (radians), du sillet vers le chevalet. */
  stringAngle: number
  /**
   * Distances signées (px), le long de la corde, du repère à chaque fil de
   * frette : l'index `n` est la frette `n`, l'index 0 le sillet. Négatives côté
   * sillet, positives côté chevalet, dans le repère tourné de `stringAngle`
   * (quelle que soit l'orientation du manche).
   */
  fretOffsets: readonly number[]
  /** Taille du calque d'effets (px), pour garder un effet dans le manche. */
  layer: { width: number; height: number }
  /** 0 → 1 : monte avec la série de bonnes réponses. Toujours 0 sur une erreur. */
  intensity: number
  /** Série en cours (tentative incluse). */
  streak: number
  /** Temps de réaction (ms) ; `null` si le temps s'est écoulé. */
  reactionMs: number | null
  /** Points marqués par cette réponse, multiplicateur compris (0 sur une erreur). */
  points: number
  /**
   * Multiplicateur appliqué : 2 pendant un combo ou sur une note de triade jouée
   * à temps, sinon 1. La pastille `RevealCombo` l'affiche.
   */
  multiplier: number
  /** Graine déterministe propre à la révélation, pour varier les détails (`seededRandom`). */
  seed: number
  /**
   * Temps (ms) avant l'apparition de la note suivante (ou de l'écran de fin) :
   * l'étiquette devrait commencer à s'effacer un peu avant (`revealExit` du kit).
   * L'effet peut durer plus longtemps, sa traîne chevauchant la note suivante.
   */
  budgetMs: number
  /** Couleur de feedback (expression CSS) : succès ou erreur. */
  color: string
  /** Couleur de texte lisible sur `color` (expression CSS). */
  colorForeground: string
  /** Blanc « chauffé » des étincelles, éclats et flashs (expression CSS). */
  highlight: string
  /**
   * L'utilisateur préfère réduire les animations. N'est à lire que si l'effet
   * déclare `handlesReducedMotion` ; sinon le calque joue `ReducedMotionReveal` à sa place.
   */
  reducedMotion: boolean
  /** À appeler quand l'effet a fini de jouer (un seul appel compte). */
  onComplete: () => void
}

export interface RevealEffect {
  /** Identifiant stable (kebab-case), unique dans le registre. */
  id: string
  /** Nom lisible, pour le débogage et une future galerie d'effets. */
  name: string
  /** Issues prises en charge. */
  outcomes: readonly RevealOutcome[]
  /** Poids relatif dans le tirage (1 par défaut). */
  weight?: number
  /**
   * Durée de vie maximale (ms) : passé ce délai, l'effet est démonté même sans
   * `onComplete`. Par défaut `DEFAULT_MAX_DURATION_MS` (3 s).
   */
  maxDurationMs?: number
  /**
   * `true` : l'effet gère lui-même `reducedMotion`. Sinon, quand l'utilisateur
   * préfère réduire les animations, le calque joue `ReducedMotionReveal` à sa place.
   */
  handlesReducedMotion?: boolean
  Component: ComponentType<RevealEffectProps>
}
