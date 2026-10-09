import { describe, expect, it } from 'vitest'

import { SCALE_RULES } from '@/game/config'
import { rateGame, retainedScore } from '@/game/engine/rating'
import { gameReducer } from '@/game/engine/reducer'
import { deadlineAt } from '@/game/engine/selectors'
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
    const missed = play(play(play(opened, 800), 2500), 800)
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
      points: (shape.notes.length - 1) * SCALE_RULES.pointsPerNote,
    })
    // Le temps reprend, repoussé de la durée de la pause.
    expect(s.pausedAt).toBeNull()
    expect(s.pausedMs).toBeGreaterThan(0)
    expect(deadlineAt(s)).toBe(s.startedAt! + level.durationMs + s.pausedMs)
    // Ni combo ni coup de pouce pendant le parcours.
    expect(s.combo).toBeNull()
    expect(s.assist).toBeNull()
  })

  it('récompense un parcours sans faute', () => {
    let s = running
    const scoreBefore = s.score
    for (let i = 0; i < shape.notes.length; i++) s = play(s, 300)
    const expected = shape.notes.length * SCALE_RULES.pointsPerNote + SCALE_RULES.perfectBonus
    expect(s.lastScaleRun).toMatchObject({ perfect: true, points: expected })
    expect(s.score - scoreBefore).toBe(expected)
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
