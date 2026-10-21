import { describe, expect, it } from 'vitest'

import { SCALE_RULES, SCORING, TRIAD_RULES } from '@/game/config'
import { rateGame, retainedScore } from '@/game/engine/rating'
import { gameReducer } from '@/game/engine/reducer'
import { basePoints } from '@/game/engine/scoring'
import { deadlineAt, scaleNoteDeadlineAt } from '@/game/engine/selectors'
import { planTriad, scaleChallenge, triadChallenge } from '@/game/engine/triad'
import type { GameState, TriadPlan } from '@/game/engine/types'
import { remainingMs } from '@/game/engine/useCountdown'
import type { TriadVoicing } from '@/game/music/chords'
import type { PitchClass } from '@/game/music/notes'
import {
  pentatonicBoxes,
  scaleName,
  scalePitchClasses,
  shapeAroundTriad,
} from '@/game/music/scales'
import { midiAt, pitchClassAt, STANDARD_TUNING } from '@/game/music/tuning'

import { TEST_LEVEL, testState } from './fixtures'

const level = TEST_LEVEL

// Do♯ majeur sur les trois cordes graves : Do♯ (9ᵉ case), Fa (8ᵉ), Sol♯ (6ᵉ).
const voicing: TriadVoicing = {
  root: 1,
  quality: 'major',
  notes: [
    { stringIndex: 0, fret: 9, pc: 1 },
    { stringIndex: 1, fret: 8, pc: 5 },
    { stringIndex: 2, fret: 6, pc: 8 },
  ],
}

describe('formes pentatoniques', () => {
  it('nomme les gammes', () => {
    expect(scaleName(9, 'minor')).toBe('La pentatonique mineure')
    expect(scaleName(1, 'major')).toBe('Do♯ pentatonique majeure')
    expect(scalePitchClasses(9, 'minor')).toEqual([9, 0, 2, 4, 7])
  })

  it('dessine des boîtes de deux notes par corde, du grave à l’aigu', () => {
    for (const quality of ['major', 'minor'] as const) {
      for (let root = 0; root < 12; root++) {
        const boxes = pentatonicBoxes(STANDARD_TUNING, root as PitchClass, quality, level.frets)
        expect(boxes.length).toBeGreaterThan(0)
        const scale = new Set(scalePitchClasses(root as PitchClass, quality))
        for (const box of boxes) {
          expect(box).toHaveLength(12)
          box.forEach((note, i) => {
            expect(note.stringIndex).toBe(Math.floor(i / 2))
            expect(scale.has(pitchClassAt(STANDARD_TUNING, note.stringIndex, note.fret))).toBe(true)
            expect(note.fret).toBeGreaterThanOrEqual(level.frets.min)
            expect(note.fret).toBeLessThanOrEqual(level.frets.max)
          })
          // Hauteurs strictement croissantes, sans sauter de degré de la gamme.
          const midis = box.map((n) => midiAt(STANDARD_TUNING, n.stringIndex, n.fret))
          for (let i = 1; i < midis.length; i++) {
            expect(midis[i]).toBeGreaterThan(midis[i - 1])
            expect(midis[i] - midis[i - 1]).toBeLessThanOrEqual(3)
          }
          // Une boîte tient sous la main : cinq cases au plus.
          const frets = box.map((n) => n.fret)
          expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it('choisit la boîte qui contient la triade', () => {
    const around = shapeAroundTriad(STANDARD_TUNING, voicing, level.frets)!
    expect(around.shape).toMatchObject({ root: 1, quality: 'major', kind: 'pentatonic' })
    expect(around.accents).toHaveLength(3)
    for (const i of around.accents) {
      const note = around.shape.notes[i]
      expect(
        voicing.notes.some((t) => t.stringIndex === note.stringIndex && t.fret === note.fret),
      ).toBe(true)
    }
  })
})

describe('parcours de gamme en partie', () => {
  const plan: TriadPlan = planTriad(voicing, level, STANDARD_TUNING)
  const shape = plan.scale!.shape

  const started = gameReducer(testState(), {
    type: 'start',
    now: 0,
    challenge: { id: 1, stringIndex: 0, fret: 1, pc: 5 },
  })
  let id = 10
  /** Répond à la note en cours en `reaction` ms, puis passe à la suivante comme le ferait `useGame`. */
  function play(s: GameState, reaction: number, right = true): GameState {
    const t = s.challengeShownAt! + reaction
    const pc = right ? s.challenge!.pc : (((s.challenge!.pc + 1) % 12) as PitchClass)
    let next = gameReducer(s, { type: 'guess', pc, now: t, roll: 0 })
    if (next.phase !== 'playing') return next
    const challenge = next.scaleRun
      ? scaleChallenge(++id, next.scaleRun, next.scaleRun.step)
      : next.triad
        ? triadChallenge(++id, next.triad, next.triad.step)
        : { id: ++id, stringIndex: 0, fret: 1, pc: 5 as PitchClass }
    next = gameReducer(next, { type: 'next', challenge, now: t + 400 })
    return next
  }
  const first = gameReducer(started, { type: 'guess', pc: 5, now: 1000 })
  const opened = gameReducer(first, {
    type: 'next',
    challenge: triadChallenge(2, plan, 0),
    now: 1400,
    triad: plan,
  })
  /** Triade réussie : le parcours s'ouvre sur la première note de la forme. */
  const running = play(play(play(opened, 800), 800), 800)

  it('s’ouvre après une triade réussie et suspend le temps', () => {
    expect(running.lastTriad).toMatchObject({ success: true, scale: 'pentatonic' })
    expect(running.scaleRun).toMatchObject({ step: 0, outcomes: [], points: 0 })
    expect(running.scaleRun!.notes).toBe(shape.notes)
    expect(running.challenge).toMatchObject({ scale: true, ...shape.notes[0] })
    expect(running.pausedAt).not.toBeNull()
    expect(deadlineAt(running)).toBeNull()
    // Le compte à rebours reste figé, quelle que soit l'heure.
    expect(remainingMs(running, 50_000)).toBe(remainingMs(running, 900_000))
  })

  it('ne s’ouvre pas sur une triade manquée', () => {
    const missed = play(play(play(opened, 800), TRIAD_RULES.fastReactionMs + 500), 800)
    expect(missed.lastTriad).toMatchObject({ success: false })
    expect(missed.lastTriad?.scale).toBeUndefined()
    expect(missed.scaleRun).toBeNull()
    expect(missed.pausedAt).toBeNull()
  })

  it('va au bout de la forme, sans compter pour la progression', () => {
    let s = running
    const before = { correctCount: s.correctCount, mistakes: s.mistakes, streak: s.streak }
    for (let i = 0; i < shape.notes.length; i++) s = play(s, 300, i !== 4)
    expect(s.scaleRun).toBeNull()
    expect(s).toMatchObject(before)
    expect(s.lastScaleRun).toMatchObject({
      hits: shape.notes.length - 1,
      total: shape.notes.length,
      perfect: false,
      points: (shape.notes.length - 1) * basePoints(300),
    })
    // Le temps reprend, repoussé de la durée de la pause.
    expect(s.pausedAt).toBeNull()
    expect(s.pausedMs).toBeGreaterThan(0)
    expect(deadlineAt(s)).toBe(s.startedAt! + level.durationMs + s.pausedMs)
    // Pas de coup de pouce ; le combo, allumé pendant la triade, a traversé le parcours
    // jauge figée : son échéance recule de la durée de la pause, sans recharge.
    expect(s.assist).toBeNull()
    expect(running.combo).not.toBeNull()
    expect(s.combo).toEqual({
      ...running.combo!,
      endsAt: running.combo!.endsAt + s.pausedMs - running.pausedMs,
    })
  })

  describe('anneau de chaque note', () => {
    const shownAt = running.challengeShownAt!
    const deadline = shownAt + SCALE_RULES.noteMs

    it('donne à la note en attente son propre délai, le temps de la partie restant suspendu', () => {
      expect(scaleNoteDeadlineAt(running)).toBe(deadline)
      expect(deadlineAt(running)).toBeNull()
      // Pendant la révélation d'une réponse, rien ne s'égrène.
      expect(
        scaleNoteDeadlineAt(gameReducer(running, { type: 'guess', pc: 0, now: shownAt + 300 })),
      ).toBeNull()
    })

    it('manque la note quand l’anneau se vide, et passe à la suivante', () => {
      expect(gameReducer(running, { type: 'scaleNoteTimeUp', now: deadline - 1 })).toBe(running)
      const s = gameReducer(running, { type: 'scaleNoteTimeUp', now: deadline })
      expect(s.lastResult).toMatchObject({
        guess: null,
        correct: false,
        points: 0,
        reactionMs: null,
        at: deadline,
        bonus: 'scale',
      })
      expect(s).toMatchObject({ locked: true, score: running.score })
      expect(s.scaleRun).toMatchObject({ step: 1, outcomes: ['miss'] })
    })

    it('refuse une réponse arrivée après l’échéance, même juste', () => {
      const late = gameReducer(running, {
        type: 'guess',
        pc: running.challenge!.pc,
        now: deadline + 50,
      })
      expect(late.lastResult).toMatchObject({ guess: null, correct: false, at: deadline })
    })

    it('perd le supplément sans faute sur une note laissée filer', () => {
      let s = gameReducer(running, { type: 'scaleNoteTimeUp', now: deadline })
      s = gameReducer(s, {
        type: 'next',
        challenge: scaleChallenge(++id, s.scaleRun!, s.scaleRun!.step),
        now: deadline + 400,
      })
      for (let i = 1; i < shape.notes.length; i++) s = play(s, 300)
      expect(s.lastScaleRun).toMatchObject({ perfect: false, hits: shape.notes.length - 1 })
    })
  })

  it('récompense un parcours sans faute', () => {
    let s = running
    const scoreBefore = s.score
    for (let i = 0; i < shape.notes.length; i++) s = play(s, 300)
    const expected = shape.notes.length * basePoints(300) + SCALE_RULES.perfectBonus
    expect(s.lastScaleRun).toMatchObject({ perfect: true, points: expected })
    expect(s.score - scoreBefore).toBe(expected)
  })

  it('paie chaque note au barème de son temps de réaction, sans multiplicateur', () => {
    const shownAt = running.challengeShownAt!
    const pc = running.challenge!.pc
    const answerIn = (ms: number) =>
      gameReducer(running, { type: 'guess', pc, now: shownAt + ms }).lastResult
    expect(answerIn(SCORING.criticalMs)).toMatchObject({
      points: SCORING.criticalPoints,
      multiplier: 1,
    })
    expect(answerIn(1500)).toMatchObject({ points: basePoints(1500), multiplier: 1 })
    expect(basePoints(1500)).toBeLessThan(SCORING.criticalPoints)
    // Le combo, allumé pendant la triade, ne double pas le parcours.
    expect(running.combo).not.toBeNull()
  })

  it('reste hors de la notation : ni ses points, ni sa pause', () => {
    let s = running
    for (let i = 0; i < shape.notes.length; i++) s = play(s, 300)
    expect(retainedScore(s.results)).toBe(retainedScore(running.results))
    // Pause déduite : la part de temps restante ne voit que le temps de jeu.
    const won = { ...s, phase: 'won' as const, endedAt: s.pausedMs + 10_000 }
    expect(rateGame(won).remainingShare).toBeCloseTo(1 - 10_000 / level.durationMs, 5)
  })
})
