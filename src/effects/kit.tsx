/* oxlint-disable react/only-export-components -- le kit regroupe à dessein composants, classes et utilitaires partagés */
import { useEffect, useRef, type CSSProperties } from 'react'
import { motion, type HTMLMotionProps, type MotionStyle, type Transition } from 'motion/react'

import { cn } from '@/lib/utils'
import { ease } from '@/theme/motion'
import { EXIT_FADE_MS, EXIT_LEAD_MS } from './reveal-props'

/**
 * Kit partagé des effets de révélation.
 *
 * Restyler ce fichier restyle tous les effets : étiquette, halo, pastille de
 * combo, révélations de secours. Pour construire un effet (`RevealEffectProps`,
 * voir `types.ts`) :
 *
 * 1. Racine : `<RevealRoot x={x} y={y} effect="mon-effet">`, ancre de taille
 *    nulle posée sur le repère (`data-slot="reveal-effect"`). Tout s'y place
 *    avec `REVEAL_CENTERED` ; la racine accepte les props Motion (fondu global).
 * 2. Étiquette : taille `labelFontSize(markerSize)`, classes `REVEAL_PILL`,
 *    couleurs `revealPillStyle(color, colorForeground, halo)`. `estimateLabelBox`
 *    donne ses demi-axes pour faire partir des éléments de son bord.
 * 3. Série : `<RevealCombo streak={streak} color={color} colorForeground={…}
 *    className="…décalage…" />` ne rend rien sous `COMBO_MIN_STREAK` ; ses props
 *    Motion règlent son entrée (`comboScaleFor(streak)` pour l'échelle).
 * 4. Temps : `revealExit(budgetMs)` cale le fondu de sortie sur l'arrivée de la
 *    note suivante ; `useCompleteAfter(exit.lifetimeMs, onComplete)` démonte l'effet.
 * 5. Couleurs : `color`, `colorForeground`, `highlight` sont des expressions CSS.
 *    Canvas, Rive, Lottie : `resolveCssColor(élément, couleur)`.
 * 6. Hasard : `seededRandom(seed)` (`@/lib/random`) — même graine, même rendu.
 * 7. Mouvement réduit : rien à faire, le calque joue `ReducedMotionReveal` à la
 *    place de l'effet. Pour le gérer soi-même : `handlesReducedMotion: true` et
 *    lire `reducedMotion` (`<ReducedMotionReveal {...props} effectId="…" />` reste possible).
 * 8. Géométrie : `stringAngle` oriente un repère « le long de la corde » ;
 *    `fretOffsets[n]` y place la frette `n` (0 = sillet).
 */

/** Centre un élément sur le point d'ancrage de l'effet (le repère de note). */
export const REVEAL_CENTERED = 'absolute top-0 left-0 -translate-1/2'

/** Racine d'un effet : ancre de taille nulle, débordement visible, sans interaction. */
export const REVEAL_ROOT = 'pointer-events-none absolute size-0 overflow-visible'

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

/**
 * Demi-axes estimés (px) de l'étiquette `REVEAL_PILL` : largeur selon le nombre
 * de caractères, hauteur exacte (1em + 2 × 0,38em).
 */
export function estimateLabelBox(
  fontSize: number,
  label: string,
): { halfW: number; halfH: number } {
  return {
    halfW: (fontSize * (0.62 * [...label].length + 1.4)) / 2,
    halfH: (fontSize * 1.76) / 2,
  }
}

/**
 * Couleurs de l'étiquette : fond `color`, texte `colorForeground` et halo de
 * `glowPx` (0 = sans halo) teinté à `glowMix` % de la couleur.
 */
export function revealPillStyle(
  color: string,
  colorForeground: string,
  glowPx: number,
  glowMix = 55,
): CSSProperties {
  return {
    background: color,
    color: colorForeground,
    boxShadow:
      glowPx > 0
        ? `0 0 ${glowPx}px color-mix(in oklch, ${color} ${glowMix}%, transparent)`
        : undefined,
  }
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

export interface RevealExit {
  /** Début du fondu de sortie (s depuis le montage). */
  fadeAt: number
  /** Durée du fondu (s). */
  fadeFor: number
  /** Transition Motion de la racine, pour `animate={{ opacity: [1, 1, 0] }}`. */
  transition: Transition
  /** Durée de vie conseillée (ms), pour `useCompleteAfter`. */
  lifetimeMs: number
}

export interface RevealExitOptions {
  /** Avance du fondu sur la note suivante (ms). */
  leadMs?: number
  /** Durée du fondu (ms). */
  fadeMs?: number
  /** Maintien minimal avant le fondu (ms), pour les budgets très courts. */
  minHoldMs?: number
}

/**
 * Calendrier de sortie calé sur `budgetMs` : l'étiquette commence à s'effacer
 * `leadMs` avant la note suivante, qu'elle ne masque donc jamais à pleine opacité.
 */
export function revealExit(
  budgetMs: number,
  { leadMs = EXIT_LEAD_MS, fadeMs = EXIT_FADE_MS, minHoldMs = 200 }: RevealExitOptions = {},
): RevealExit {
  const fadeAtMs = Math.max(minHoldMs, budgetMs - leadMs)
  const fadeAt = fadeAtMs / 1000
  const fadeFor = fadeMs / 1000
  const total = fadeAt + fadeFor
  return {
    fadeAt,
    fadeFor,
    lifetimeMs: Math.round(fadeAtMs + fadeMs) + 20,
    transition: {
      duration: total,
      times: [0, fadeAt / total, 1],
      // Une courbe par segment : avec `times`, une courbe unique s'appliquerait à toute la timeline.
      ease: ['linear', ease.outQuart],
    },
  }
}

/* — Composants — */

export type RevealRootProps = Omit<HTMLMotionProps<'div'>, 'style'> & {
  x: number
  y: number
  /** Identifiant de l'effet, exposé en `data-effect`. */
  effect: string
  style?: MotionStyle
}

/** Racine d'un effet : ancre de taille nulle en (`x`, `y`), animable avec Motion. */
export function RevealRoot({ x, y, effect, className, style, ...motionProps }: RevealRootProps) {
  return (
    <motion.div
      data-slot="reveal-effect"
      data-effect={effect}
      className={cn(REVEAL_ROOT, className)}
      style={{ left: x, top: y, ...style }}
      {...motionProps}
    />
  )
}

export type RevealComboProps = Omit<HTMLMotionProps<'span'>, 'children' | 'color'> & {
  streak: number
  color: string
  colorForeground: string
}

/**
 * Pastille de combo « ×N » (rien sous `COMBO_MIN_STREAK`). À placer dans le
 * conteneur de l'étiquette ; `className` règle son décalage, les props Motion son entrée.
 */
export function RevealCombo({
  streak,
  color,
  colorForeground,
  className,
  style,
  ...motionProps
}: RevealComboProps) {
  if (streak < COMBO_MIN_STREAK) return null
  return (
    <motion.span
      data-slot="reveal-combo"
      className={cn(REVEAL_COMBO, className)}
      style={{ background: colorForeground, color, boxShadow: `0 0 0 1.5px ${color}`, ...style }}
      {...motionProps}
    >
      ×{streak}
    </motion.span>
  )
}

/** Props communes aux révélations de secours : un sous-ensemble de `RevealEffectProps`. */
export interface FallbackRevealProps {
  x: number
  y: number
  markerSize: number
  label: string
  color: string
  colorForeground: string
  onComplete: () => void
  /** Effet remplacé, exposé en `data-effect`. */
  effectId: string
  /** Durée totale (ms) avant `onComplete`. */
  durationMs: number
  /** Halo de l'étiquette (px). */
  glowPx?: number
}

/** Étiquette immobile, centrée sur le repère. */
function StaticLabel({
  markerSize,
  label,
  color,
  colorForeground,
  glowPx,
}: Pick<FallbackRevealProps, 'markerSize' | 'label' | 'color' | 'colorForeground' | 'glowPx'>) {
  return (
    <div
      data-slot="reveal-label"
      className={cn(REVEAL_CENTERED, 'w-max')}
      style={{ fontSize: labelFontSize(markerSize) }}
    >
      <span
        data-slot="reveal-label-pill"
        className={REVEAL_PILL}
        style={revealPillStyle(color, colorForeground, glowPx ?? 0)}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * Révélation en mouvement réduit : l'étiquette apparaît en fondu, reste lisible,
 * puis s'efface ; aucun déplacement. Jouée par le calque à la place d'un effet
 * qui ne déclare pas `handlesReducedMotion`.
 */
export function ReducedMotionReveal({
  x,
  y,
  effectId,
  durationMs,
  onComplete,
  glowPx = 14,
  ...label
}: FallbackRevealProps) {
  useCompleteAfter(durationMs, onComplete)
  const total = durationMs / 1000
  const fadeIn = Math.min(0.12, total * 0.2)
  const fadeOut = Math.min(EXIT_FADE_MS / 1000, total * 0.4)
  return (
    <RevealRoot
      x={x}
      y={y}
      effect={effectId}
      data-variant="reduced-motion"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{
        duration: total,
        times: [0, fadeIn / total, 1 - fadeOut / total, 1],
        ease: [ease.outQuart, 'linear', ease.outQuart],
      }}
    >
      <StaticLabel {...label} glowPx={glowPx} />
    </RevealRoot>
  )
}

/**
 * Révélation de secours, sans aucune animation (ni Motion) : utilisée quand un
 * effet plante ou qu'aucun effet n'est enregistré, pour que la note soit révélée.
 */
export function StaticReveal({
  x,
  y,
  effectId,
  durationMs,
  onComplete,
  glowPx = 10,
  ...label
}: FallbackRevealProps) {
  useCompleteAfter(durationMs, onComplete)
  return (
    <div
      data-slot="reveal-effect"
      data-effect={effectId}
      data-variant="fallback"
      className={REVEAL_ROOT}
      style={{ left: x, top: y }}
    >
      <StaticLabel {...label} glowPx={glowPx} />
    </div>
  )
}

/* — Couleurs — */

export interface ResolvedColor {
  /** Valeur calculée (ex. `oklch(0.78 0.2 150)`) : CSS et canvas 2D l'acceptent. */
  css: string
  /** sRGB 8 bits et alpha 0–1. Lottie : diviser r, g, b par 255 ; Rive : ARGB entier. */
  rgba: [number, number, number, number]
}

let pixel: CanvasRenderingContext2D | null | undefined

function readPixel(css: string): [number, number, number, number] {
  if (pixel === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    pixel = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!pixel) return [0, 0, 0, 1]
  pixel.clearRect(0, 0, 1, 1)
  pixel.fillStyle = '#000'
  pixel.fillStyle = css
  pixel.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data
  return [r, g, b, Math.round((a / 255) * 1000) / 1000]
}

/**
 * Résout une expression de couleur CSS (`var(--…)`, `color-mix(…)`…) dans le
 * contexte de `el` (ses variables héritées), via un élément sonde puis un pixel
 * de canvas pour les composantes. À appeler une fois au montage, pas à chaque image.
 * Hors navigateur, renvoie l'expression telle quelle et du noir opaque.
 */
export function resolveCssColor(el: Element, css: string): ResolvedColor {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return { css, rgba: [0, 0, 0, 1] }
  }
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = css
  el.appendChild(probe)
  const computed = getComputedStyle(probe).color || css
  probe.remove()
  return { css: computed, rgba: readPixel(computed) }
}
