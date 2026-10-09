import { describe, expect, it } from 'vitest'

import { TRIAD_RULES } from '@/game/config'
import { averageReactionMs } from '@/game/engine/assist'
import { gameReducer } from '@/game/engine/reducer'
import { canStartTriad, createTriadVoicing, triadChallenge } from '@/game/engine/triad'
import type { Challenge, GameState, TriadPlan } from '@/game/engine/types'
import { chordName, triadPitchClasses, triadVoicings, type TriadQuality } from '@/game/music/chords'
import type { PitchClass } from '@/game/music/notes'
import { midiAt, pitchClassAt, STANDARD_TUNING } from '@/game/music/tuning'

import { TEST_LEVEL, testState } from './fixtures'

const level = TEST_LEVEL
/** Seuil de rapidité d'une note de triade (ms). */
const LIMIT = TRIAD_RULES.fastReactionMs
const range = { frets: level.frets, strings: level.strings, maxFretSpan: TRIAD_RULES.maxFretSpan }

describe('triades', () => {
  it('nomme et construit les accords', () => {
    expect(chordName(9, 'minor')).toBe('La mineur')
    expect(chordName(6, 'major')).toBe('Fa♯ majeur')
    expect(triadPitchClasses(0, 'major')).toEqual([0, 4, 7])
    expect(triadPitchClasses(9, 'minor')).toEqual([9, 0, 4])
  })

  it('ne propose que des voicings jouables : trois cordes voisines, fondamentale, tierce, quinte', () => {
    for (const quality of ['major', 'minor'] as TriadQuality[]) {
      for (let root = 0; root < 12; root++) {
        const voicings = triadVoicings(STANDARD_TUNING, root as PitchClass, quality, range)
        expect(voicings.length).toBeGreaterThan(0)
        for (const { notes } of voicings) {
          const pcs = triadPitchClasses(root as PitchClass, quality)
          expect(notes.map((n) => n.pc)).toEqual(pcs)
          expect(notes.map((n) => pitchClassAt(STANDARD_TUNING, n.stringIndex, n.fret))).toEqual(
            pcs,
          )
          // Cordes voisines, du grave à l'aigu, et hauteurs croissantes dans l'octave.
          expect(notes[1].stringIndex).toBe(notes[0].stringIndex + 1)
          expect(notes[2].stringIndex).toBe(notes[1].stringIndex + 1)
          const midis = notes.map((n) => midiAt(STANDARD_TUNING, n.stringIndex, n.fret))
          expect(midis[2] - midis[0]).toBe(7)
          expect(midis[1]).toBeGreaterThan(midis[0])
          // Dans le périmètre du niveau, la main peu écartée.
          const frets = notes.map((n) => n.fret)
          expect(Math.min(...frets)).toBeGreaterThanOrEqual(level.frets.min)
          expect(Math.max(...frets)).toBeLessThanOrEqual(level.frets.max)
          expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(range.maxFretSpan)
        }
      }
    }
  })

  it('tire une triade dont la fondamentale diffère de la note précédente', () => {
    let seed = 3
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 200; i++) {
      const previous: Challenge = { id: 0, stringIndex: 0, fret: 5, pc: (i % 12) as PitchClass }
      const voicing = createTriadVoicing(level, STANDARD_TUNING, random, previous)
      expect(voicing).not.toBeNull()
      expect(voicing!.root).not.toBe(previous.pc)
    }
  })
})

describe('triade en partie', () => {
  // La mineur sur les cordes de La, Ré et Sol : La (5ᵉ case), Do (3ᵉ), Mi (2ᵉ).
  const voicing: TriadPlan = {
    root: 9,
    quality: 'minor',
    notes: [
      { stringIndex: 0, fret: 5, pc: 9 },
      { stringIndex: 1, fret: 3, pc: 0 },
      { stringIndex: 2, fret: 2, pc: 4 },
    ],
    // Sans forme de gamme : ce lot teste la triade seule.
    scale: null,
  }
  const note = (id: number, pc: PitchClass): Challenge => ({ id, stringIndex: 0, fret: 1, pc })

  const started = gameReducer(testState(), {
    type: 'start',
    now: 0,
    challenge: note(1, 2),
  })
  /** Première note jouée (juste, en 1 s), puis la triade ouverte à 1 400 ms. */
  const answered = gameReducer(started, { type: 'guess', pc: 2, now: 1000 })
  const opened = gameReducer(answered, {
    type: 'next',
    challenge: triadChallenge(2, voicing, 0),
    now: 1400,
    triad: voicing,
  })

  /** Répond à la note de triade en cours en `reaction` ms, puis enchaîne la suivante. */
  function answer(s: GameState, reaction: number, right = true): GameState {
    const t = s.challengeShownAt! + reaction
    const pc = right ? s.challenge!.pc : (((s.challenge!.pc + 1) % 12) as PitchClass)
    let next = gameReducer(s, { type: 'guess', pc, now: t, roll: 0 })
    if (next.triad) {
      next = gameReducer(next, {
        type: 'next',
        challenge: triadChallenge(100 + next.triad.step, next.triad, next.triad.step),
        now: t + 400,
      })
    }
    return next
  }

  it('s’ouvre sur la fondamentale et éteint un combo en cours', () => {
    expect(opened.triad).toMatchObject({ root: 9, quality: 'minor', step: 0, clean: true })
    expect(opened.triadsStarted).toBe(1)
    expect(opened.challenge).toMatchObject({ pc: 9, triad: true })
    const withCombo = { ...answered, combo: { startedAt: 0, endsAt: 99_999 }, fastStreak: 2 }
    const s = gameReducer(withCombo, {
      type: 'next',
      challenge: triadChallenge(2, voicing, 0),
      now: 1400,
      triad: voicing,
    })
    expect(s).toMatchObject({ combo: null, fastStreak: 0 })
  })

  it('est réussie quand les trois notes sont justes, chacune sous le seuil de rapidité', () => {
    const s = answer(answer(answer(opened, 900), 1500), LIMIT - 1)
    expect(s.triad).toBeNull()
    expect(s.lastTriad).toMatchObject({
      root: 9,
      quality: 'minor',
      success: true,
      missed: 0,
      slowestMs: LIMIT - 1,
    })
    expect(s.lastTriad?.reason).toBeUndefined()
    // Les trois notes comptent pour la progression, doublées (anneau battu), sans combo.
    expect(s.correctCount).toBe(4)
    const triadResults = s.results.filter((r) => r.bonus === 'triad')
    expect(triadResults).toHaveLength(3)
    expect(triadResults.map((r) => r.multiplier)).toEqual([2, 2, 2])
    expect(triadResults.every((r) => r.points === r.basePoints * 2)).toBe(true)
    expect(s.combo).toBeNull()
    expect(s.fastStreak).toBe(0)
  })

  it('double chaque note trouvée avant la fin de son anneau, même la triade perdue', () => {
    // Fausse note d'emblée : la triade est perdue, mais les deux suivantes restent à battre.
    const s = answer(answer(answer(opened, 900, false), 1200), LIMIT)
    expect(s.lastTriad).toMatchObject({ success: false, reason: 'wrong' })
    const [missed, inTime, late] = s.results.filter((r) => r.bonus === 'triad')
    expect(missed).toMatchObject({ correct: false, multiplier: 1, points: 0 })
    expect(inTime).toMatchObject({ correct: true, multiplier: 2, points: inTime.basePoints * 2 })
    // Pile à la fin de l'anneau : trop tard, la note n'est plus doublée.
    expect(late).toMatchObject({ correct: true, multiplier: 1, points: late.basePoints })
    // Le combo reste éteint : les deux bonus ne se cumulent pas.
    expect(s.combo).toBeNull()
    expect(s.results.some((r) => r.comboTriggered)).toBe(false)
  })

  it('va au bout de ses trois notes, mais échoue sur une réponse lente ou fausse, et dit pourquoi', () => {
    const slow = answer(answer(answer(opened, 900), LIMIT), 900)
    expect(slow.lastTriad).toMatchObject({
      success: false,
      reason: 'slow',
      missed: 0,
      slowestMs: LIMIT,
    })
    const wrong = answer(opened, 900, false)
    expect(wrong.triad).toMatchObject({ step: 1, clean: false, missed: 1 })
    // Une erreur l'emporte sur la lenteur comme raison.
    expect(answer(answer(wrong, LIMIT + 500), 500).lastTriad).toMatchObject({
      success: false,
      reason: 'wrong',
      missed: 1,
      slowestMs: LIMIT + 500,
    })
  })

  it('ne nourrit pas le coup de pouce', () => {
    const s = answer(answer(answer(opened, 1500), 1500), 1500)
    // Moyenne calculée sans les notes de la triade : seule la première réponse compte.
    expect(averageReactionMs(s.results)).toBe(1000)
    // Même pour un joueur déjà lent (moyenne > 5 s), aucune note de la triade
    // n'ouvre le coup de pouce, malgré un tirage favorable.
    const slowPlayer: GameState = {
      ...opened,
      // Deux réponses ordinaires lentes : de quoi juger la moyenne (`ASSIST_RULES.minAnswers`).
      results: [0, 1].map((id) => ({ ...opened.results[0], id, reactionMs: 9000 })),
    }
    expect(averageReactionMs(slowPlayer.results)).toBeGreaterThan(5000)
    let t: GameState = slowPlayer
    for (let i = 0; i < 3; i++) {
      t = answer(t, 9000)
      expect(t.assist).toBeNull()
    }
    expect(t.assistUsed).toBe(false)
  })

  it('ne commence qu’après quelques notes ordinaires, hors coup de pouce, avec assez de notes à trouver', () => {
    const playing = { ...answered, phase: 'playing' as const }
    expect(canStartTriad(playing)).toBe(true)
    expect(canStartTriad({ ...playing, triadCooldown: 1 })).toBe(false)
    expect(canStartTriad({ ...playing, assist: { pc: 2, total: 3, remaining: 3 } })).toBe(false)
    const late = { ...playing, correctCount: level.targetCount - TRIAD_RULES.minNotesLeft + 1 }
    expect(canStartTriad(late)).toBe(false)
    // Refusée par le moteur, la note reste mais redevient ordinaire.
    const refused = gameReducer(
      { ...answered, triadCooldown: 2 },
      { type: 'next', challenge: triadChallenge(2, voicing, 0), now: 1400, triad: voicing },
    )
    expect(refused.triad).toBeNull()
    expect(refused.challenge?.triad).toBeUndefined()
    expect(refused.triadsStarted).toBe(0)
  })

  it('revient plusieurs fois dans la partie, séparée par quelques notes ordinaires', () => {
    // Niveau plus long : deux triades et leurs notes d'intervalle y tiennent.
    const long = { ...opened, level: { ...level, targetCount: 24 } }
    let s = answer(answer(answer(long, 900), 900), 900)
    expect(s.triadCooldown).toBe(TRIAD_RULES.minNotesBetween)
    expect(canStartTriad(s)).toBe(false)
    // Notes ordinaires, justes ou fausses : chacune rapproche la suivante.
    for (let i = 0; i < TRIAD_RULES.minNotesBetween; i++) {
      s = gameReducer(s, { type: 'next', challenge: note(50 + i, 2), now: s.lastResult!.at + 400 })
      expect(canStartTriad(s)).toBe(false)
      s = gameReducer(s, { type: 'guess', pc: i === 1 ? 3 : 2, now: s.challengeShownAt! + 900 })
    }
    expect(s.triadCooldown).toBe(0)
    expect(canStartTriad(s)).toBe(true)
    s = gameReducer(s, {
      type: 'next',
      challenge: triadChallenge(60, voicing, 0),
      now: s.lastResult!.at + 400,
      triad: voicing,
    })
    expect(s.triad).toMatchObject({ step: 0, clean: true, slot: 7 })
    expect(s.triadsStarted).toBe(2)
    expect(s.triadSlots).toEqual([1, 7])
  })

  it('s’efface à la fin du temps', () => {
    const s = gameReducer(opened, { type: 'timeUp', now: 200_000 })
    expect(s).toMatchObject({ phase: 'lost', triad: null })
    expect(s.lastResult).toMatchObject({ guess: null, bonus: 'triad' })
  })
})
