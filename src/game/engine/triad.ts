import { TRIAD_RULES } from '@/game/config'
import type { LevelConfig } from '@/game/levels/levels'
import { triadVoicings, type TriadVoicing } from '@/game/music/chords'
import { toPitchClass } from '@/game/music/notes'
import type { Tuning } from '@/game/music/tuning'
import type { Random } from './challenge'
import { shapeAroundTriad } from '@/game/music/scales'
import type { Challenge, GameState, ScaleRunState, TriadPlan, TriadState } from './types'

/**
 * Une triade peut-elle commencer avec la prochaine note ? Il faut une partie en
 * cours, ni triade ni coup de pouce déjà engagés, le quota de la partie non
 * atteint, et assez de notes à trouver pour que la partie ne s'achève pas
 * dessus (`TRIAD_RULES.minNotesLeft`).
 */
export function canStartTriad(
  state: Pick<
    GameState,
    'phase' | 'triad' | 'assist' | 'triadsStarted' | 'correctCount' | 'level'
  > &
    Partial<Pick<GameState, 'scaleRun'>>,
): boolean {
  return (
    state.phase === 'playing' &&
    state.triad === null &&
    !state.scaleRun &&
    state.assist === null &&
    state.triadsStarted < TRIAD_RULES.maxPerGame &&
    state.level.targetCount - state.correctCount >= TRIAD_RULES.minNotesLeft
  )
}

/**
 * Tire une triade jouable dans le périmètre du niveau : qualité et
 * fondamentale au hasard, puis un voicing parmi ceux qui tiennent sur le
 * manche. La fondamentale diffère de la note précédente (jamais deux fois la
 * même note d'affilée). `null` si aucune ne convient.
 */
export function createTriadVoicing(
  level: LevelConfig,
  tuning: Tuning,
  random: Random,
  previous?: Challenge | null,
): TriadVoicing | null {
  const quality = TRIAD_RULES.qualities[Math.floor(random() * TRIAD_RULES.qualities.length)]
  const range = { frets: level.frets, strings: level.strings, maxFretSpan: TRIAD_RULES.maxFretSpan }
  const start = Math.floor(random() * 12)
  // Fondamentales essayées dans un ordre tiré au sort ; la première qui a un voicing l'emporte.
  for (let k = 0; k < 12; k++) {
    const root = toPitchClass(start + k * 5)
    if (previous && root === previous.pc) continue
    const voicings = triadVoicings(tuning, root, quality, range)
    if (voicings.length > 0) return voicings[Math.floor(random() * voicings.length)]
  }
  return null
}

/** Note `step` de la triade, prête à être demandée. */
export function triadChallenge(
  id: number,
  triad: Pick<TriadState, 'notes'>,
  step: number,
): Challenge {
  const { stringIndex, fret, pc } = triad.notes[step]
  return { id, stringIndex, fret, pc, triad: true }
}

/**
 * Prépare une triade : son voicing et la forme de gamme qu'elle ouvrira si elle
 * est réussie (seulement si toutes les cordes sont jouables).
 */
export function planTriad(voicing: TriadVoicing, level: LevelConfig, tuning: Tuning): TriadPlan {
  const allStrings = level.strings.length === tuning.strings.length
  return { ...voicing, scale: allStrings ? shapeAroundTriad(tuning, voicing, level.frets) : null }
}

/** Note `step` du parcours de gamme, prête à être demandée. */
export function scaleChallenge(
  id: number,
  run: Pick<ScaleRunState, 'notes'>,
  step: number,
): Challenge {
  const { stringIndex, fret, pc } = run.notes[step]
  return { id, stringIndex, fret, pc, scale: true }
}
