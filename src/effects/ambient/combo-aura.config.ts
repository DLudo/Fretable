/**
 * Réglages de l'aura de combo : halo bleu et particules autour du manche.
 *
 * L'aura est procédurale (canvas) : elle suit le contour réel du manche, à
 * l'horizontale comme à la verticale, et ne pèse rien à télécharger. Tout son
 * rendu se règle ici. Pour une texture faite dans After Effects, exportez une
 * image (PNG ou WebP, fond transparent) dans `public/fx/combo/` et indiquez son
 * chemin dans `particles.sprite`.
 */
export interface ComboAuraConfig {
  /** Couleurs (expressions CSS ; les jetons du thème par défaut). */
  colors: {
    /** Halo diffus. */
    glow: string
    /** Liseré net sur le bord du manche. */
    rim: string
    /** Particules. */
    particle: string
    /** Étincelles claires, mêlées aux particules. */
    spark: string
  }
  glow: {
    /** Épaisseur du liseré (px). */
    rimWidthPx: number
    /** Portée du halo (px). */
    blurPx: number
    /** Couches de halo superposées : plus il y en a, plus il est dense. */
    passes: number
    /** Respiration du halo : fréquence (Hz) et amplitude (0 → 1). */
    pulseHz: number
    pulseDepth: number
    /** Apparition et extinction (ms). */
    fadeInMs: number
    fadeOutMs: number
    /** Éclat au déclenchement : surintensité initiale (0 = aucune) et sa décroissance (ms). */
    introBoost: number
    introDecayMs: number
    /** Fondu vers l'extrémité coupée du manche, après la 12ᵉ frette (mm). */
    endFadeMm: number
  }
  particles: {
    /** Particules émises par seconde pendant le combo. */
    ratePerSecond: number
    /** Plafond de particules vivantes. */
    max: number
    /** Gerbe émise d'un coup au déclenchement. */
    burst: number
    /** Durée de vie (ms), vitesse de départ (px/s) et rayon (px) : bornes [min, max]. */
    lifeMs: [number, number]
    speedPxPerSecond: [number, number]
    radiusPx: [number, number]
    /** Part du mouvement le long du bord (0 : départ perpendiculaire au manche). */
    drift: number
    /** Freinage par seconde (0 : aucun, 1 : arrêt en une seconde). */
    drag: number
    /** Proportion d'étincelles claires. */
    sparkRatio: number
    /** Texture des particules (`/fx/combo/particule.png`), sinon un point lumineux généré. */
    sprite: string | null
  }
  /** Marge autour du manche où halo et particules peuvent déborder (px). */
  bleedPx: number
}

export const COMBO_AURA: ComboAuraConfig = {
  colors: {
    glow: 'var(--combo-glow)',
    rim: 'var(--combo-spark)',
    particle: 'var(--combo)',
    spark: 'var(--combo-spark)',
  },
  glow: {
    rimWidthPx: 1.5,
    blurPx: 16,
    passes: 3,
    pulseHz: 1.2,
    pulseDepth: 0.3,
    fadeInMs: 180,
    fadeOutMs: 420,
    introBoost: 1.2,
    introDecayMs: 380,
    endFadeMm: 12,
  },
  particles: {
    ratePerSecond: 55,
    max: 160,
    burst: 48,
    lifeMs: [550, 1300],
    speedPxPerSecond: [14, 52],
    radiusPx: [1.2, 3.2],
    drift: 0.45,
    drag: 0.55,
    sparkRatio: 0.25,
    sprite: null,
  },
  bleedPx: 40,
}
