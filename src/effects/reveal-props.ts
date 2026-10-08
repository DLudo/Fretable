import { GAME_FEEL, NOTATION } from '@/game/config'
import type { NeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { noteName, type PitchClass } from '@/game/music/notes'
import { seededRandom } from '@/lib/random'
import type { RevealEffect, RevealEffectProps, RevealOutcome } from './types'

/**
 * Construction des props d'une révélation, partagée par le calque du jeu
 * (`RevealLayer`) et le lab : graine, budget, couleurs et géométrie y sont
 * calculés à un seul endroit.
 */

/** Filet de sécurité : un effet sans `maxDurationMs` qui oublie `onComplete` est démonté au bout de ce délai. */
export const DEFAULT_MAX_DURATION_MS = 3000

/** Durée d'affichage de la révélation de secours (effet en erreur ou registre vide). */
export const FALLBACK_REVEAL_MS = 700

/** Couleurs de feedback par issue (expressions CSS, voir `RevealEffectProps`). */
export const REVEAL_COLORS: Record<RevealOutcome, { color: string; foreground: string }> = {
  correct: { color: 'var(--feedback-success)', foreground: 'var(--feedback-success-foreground)' },
  wrong: { color: 'var(--feedback-error)', foreground: 'var(--feedback-error-foreground)' },
}

/** Blanc « chauffé » des étincelles et flashs. */
export const REVEAL_HIGHLIGHT = 'var(--reveal-highlight)'

export function revealOutcome(correct: boolean): RevealOutcome {
  return correct ? 'correct' : 'wrong'
}

/** 0 → 1 avec la série ; toujours 0 sur une erreur. */
export function revealIntensity(correct: boolean, streak: number): number {
  return correct ? Math.min(1, Math.max(0, streak / GAME_FEEL.maxStreakIntensity)) : 0
}

/** Temps avant la note suivante (ou l'écran « Temps écoulé » après une note non trouvée). */
export function revealBudgetMs(outcome: RevealOutcome, timedOut = false): number {
  if (timedOut) return GAME_FEEL.defeatDelayMs
  return outcome === 'correct' ? GAME_FEEL.holdAfterCorrectMs : GAME_FEEL.holdAfterWrongMs
}

/* — Graines — */

/** Finaliseur murmur3 : casse toute relation linéaire entre graines voisines. */
function mix32(value: number): number {
  let x = value >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return x >>> 0
}

/** Sel de session : rend chaque partie imprévisible (une valeur fixe rend le tirage reproductible). */
export function randomSalt(): number {
  const crypto = globalThis.crypto
  if (crypto?.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0]
  return (Math.random() * 2 ** 32) >>> 0
}

/**
 * Flux aléatoire d'une révélation : son premier tirage choisit l'effet
 * (`pickEffect`), le suivant donne la graine de l'effet (`drawSeed`).
 */
export function revealStream(revealId: number, salt: number): () => number {
  return seededRandom(mix32(Math.imul(revealId, 0x9e3779b1) ^ salt))
}

/**
 * Graine d'effet tirée dans le flux, *après* le choix de l'effet : elle ne
 * dépend pas de la tranche de [0, 1) qui l'a désigné, donc les variantes d'un
 * effet gardent en jeu la même distribution que dans le lab.
 */
export function drawSeed(random: () => number): number {
  return (random() * 2 ** 32) >>> 0
}

/** Graine d'effet d'une révélation dont l'effet est imposé (lab) : même chemin qu'en jeu. */
export function revealSeed(revealId: number, salt: number): number {
  const random = revealStream(revealId, salt)
  random() // tirage de l'effet, imposé ici
  return drawSeed(random)
}

/* — Géométrie — */

/** Partie géométrique des props, en px dans le calque d'effets. */
export type RevealGeometry = Pick<
  RevealEffectProps,
  'x' | 'y' | 'markerSize' | 'pxPerMm' | 'stringAngle' | 'fretOffsets' | 'layer'
>

/**
 * Géométrie d'une note à l'écran, calculée à travers la projection : valable à
 * l'horizontale comme à la verticale.
 */
export function revealGeometry(
  layout: NeckLayout,
  projection: BoardProjection,
  stringIndex: number,
  fret: number,
): RevealGeometry {
  const dot = projection.toPx(layout.position(stringIndex, fret))
  const string = layout.strings[stringIndex]
  const from = projection.toPx(string.from)
  const to = projection.toPx(string.to)
  const stringAngle = Math.atan2(to.y - from.y, to.x - from.x)
  const ux = Math.cos(stringAngle)
  const uy = Math.sin(stringAngle)
  // Index 0 : bord du sillet (x = 0) ; puis chaque fil de frette, dans l'ordre.
  const wires = [0, ...layout.frets.map((f) => f.x)]
  const fretOffsets = wires.map((wireX) => {
    const p = projection.toPx({ x: wireX, y: layout.stringY(stringIndex, wireX) })
    return (p.x - dot.x) * ux + (p.y - dot.y) * uy
  })
  return {
    x: dot.x,
    y: dot.y,
    markerSize: layout.markerRadius * 2 * projection.pxPerMm,
    pxPerMm: projection.pxPerMm,
    stringAngle,
    fretOffsets,
    layer: { width: projection.width, height: projection.height },
  }
}

/* — Props — */

export interface RevealInput {
  revealId: number
  /** Bonne note. */
  pc: PitchClass
  /** Note jouée ; `null` = temps écoulé. */
  guess: PitchClass | null
  correct: boolean
  streak: number
  /** Temps de réaction (ms) ; `null` = temps écoulé (défaut). */
  reactionMs?: number | null
  /** Points marqués (défaut 0). */
  points?: number
  /** Multiplicateur appliqué (défaut 1). */
  multiplier?: number
  stringIndex: number
  fret: number
  /** Graine de l'effet (`drawSeed` / `revealSeed`). */
  seed: number
  geometry: RevealGeometry
  reducedMotion: boolean
  onComplete: () => void
  /** Étiquette affichée ; par défaut le nom de `pc` dans la notation du jeu. */
  label?: string
}

/** Assemble les props d'un effet : issue, budget, intensité, couleurs, géométrie. */
export function buildRevealProps(input: RevealInput): RevealEffectProps {
  const outcome = revealOutcome(input.correct)
  const timedOut = input.guess === null
  const colors = REVEAL_COLORS[outcome]
  return {
    revealId: input.revealId,
    outcome,
    pc: input.pc,
    guess: input.guess,
    timedOut,
    label: input.label ?? noteName(input.pc, NOTATION),
    stringIndex: input.stringIndex,
    fret: input.fret,
    ...input.geometry,
    intensity: revealIntensity(input.correct, input.streak),
    streak: input.streak,
    reactionMs: input.reactionMs ?? null,
    points: input.points ?? 0,
    multiplier: input.multiplier ?? 1,
    seed: input.seed,
    budgetMs: revealBudgetMs(outcome, timedOut),
    color: colors.color,
    colorForeground: colors.foreground,
    highlight: REVEAL_HIGHLIGHT,
    reducedMotion: input.reducedMotion,
    onComplete: input.onComplete,
  }
}

/* — Hôte — */

/** Le fondu de sortie commence ce délai (ms) avant la note suivante… */
export const EXIT_LEAD_MS = 80
/** …et dure ce temps (ms). Valeurs par défaut de `revealExit` (kit). */
export const EXIT_FADE_MS = 260

/** Le calque joue `ReducedMotionReveal` à la place de l'effet. */
export function usesReducedMotionFallback(
  effect: RevealEffect,
  reveal: Pick<RevealEffectProps, 'reducedMotion'>,
): boolean {
  return reveal.reducedMotion && !effect.handlesReducedMotion
}

/**
 * Durée de la révélation en mouvement réduit : l'étiquette tient jusqu'à
 * l'approche de la note suivante, puis s'efface.
 */
export function reducedMotionDurationMs(budgetMs: number): number {
  return Math.max(500, budgetMs - EXIT_LEAD_MS + EXIT_FADE_MS)
}

/** Durée de vie maximale accordée à un effet par le calque (filet de sécurité). */
export function revealCapMs(
  effect: RevealEffect,
  reveal: Pick<RevealEffectProps, 'reducedMotion' | 'budgetMs'>,
): number {
  const cap = effect.maxDurationMs ?? DEFAULT_MAX_DURATION_MS
  // Les révélations de secours (mouvement réduit, erreur) ne doivent pas être coupées.
  const floor = usesReducedMotionFallback(effect, reveal)
    ? reducedMotionDurationMs(reveal.budgetMs)
    : FALLBACK_REVEAL_MS
  return Math.max(cap, floor + 100)
}
