import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { RevealLayer } from '@/effects'
import { ComboAura } from '@/effects/ambient'
import { TRIAD_RULES } from '@/game/config'
import { endScreenAt } from '@/game/engine/selectors'
import { useGame } from '@/game/engine/useGame'
import { useTriadRing } from '@/game/engine/useTriadRing'
import { createNeckLayout } from '@/game/fretboard/geometry'
import {
  orientViewBox,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { useKeyboardControls } from '@/game/input/useKeyboardControls'
import type { PitchClass } from '@/game/music/notes'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { AssistBanner } from './AssistBanner'
import { Fretboard, type FretboardGhost } from './fretboard'
import { LevelHud } from './hud'
import { LevelOverlay } from './overlays'
import { Piano, type PianoFeedback } from './piano'
import { StartCountdown } from './StartCountdown'
import { ScaleBanner } from './ScaleBanner'
import { TriadBanner } from './TriadBanner'
import { TriadIntro } from './TriadIntro'
import { PORTRAIT_QUERY, useBoardFit } from './useBoardFit'
import { useBoardImpact } from './useBoardImpact'

const NO_GHOSTS: readonly FretboardGhost[] = []

export interface GameScreenProps {
  /** Interrupteur de mode, posé en tête du HUD. */
  modeSwitch?: ReactNode
  className?: string
}

/**
 * Écran de jeu : assemble HUD, manche, piano, révélations et overlays.
 * Toute la logique vit dans `useGame` ; ce composant ne fait que du câblage.
 */
export function GameScreen({ modeSwitch, className }: GameScreenProps) {
  const game = useGame()
  const { state } = game
  const layout = useMemo(() => createNeckLayout({ tuning: game.tuning }), [game.tuning])
  const playing = state.phase === 'playing'
  const orientation: BoardOrientation = useMediaQuery(PORTRAIT_QUERY) ? 'vertical' : 'horizontal'

  // L'écran de fin attend que la dernière révélation ait pu être lue.
  const overlayAt = endScreenAt(state)
  const [overlayShownFor, setOverlayShownFor] = useState<number | null>(null)
  useEffect(() => {
    const endedAt = state.endedAt
    if (overlayAt === null || endedAt === null || overlayAt <= endedAt) return
    const timer = window.setTimeout(
      () => setOverlayShownFor(endedAt),
      Math.max(0, overlayAt - performance.now()),
    )
    return () => window.clearTimeout(timer)
  }, [overlayAt, state.endedAt])
  const overlayVisible =
    overlayAt === null || overlayAt === state.endedAt || overlayShownFor === state.endedAt

  const confirm = () => {
    if (!overlayVisible) return
    if (state.phase === 'ready' || state.phase === 'lost') game.start()
    else if (state.phase === 'won') {
      if (game.hasNextLevel) game.nextLevel()
      else game.start()
    }
  }

  const [nudge, setNudge] = useState<{ id: number; pc: PitchClass } | null>(null)
  const nudgeId = useRef(0)

  const { sharpMode, pressed } = useKeyboardControls({
    onNote: game.guess,
    onNoSharp: (pc) => setNudge({ id: ++nudgeId.current, pc }),
    onConfirm: confirm,
  })

  const feedback = useMemo<PianoFeedback | null>(() => {
    const result = state.lastResult
    if (!result) return null
    return {
      id: result.id,
      guess: result.guess,
      answer: result.challenge.pc,
      correct: result.correct,
    }
  }, [state.lastResult])

  // Anneau de la note de triade en cours : il pilote l'anneau du manche et la pastille « ×2 ».
  const ringRunning = useTriadRing(state)
  const marker =
    playing && !state.locked && state.challenge
      ? {
          id: state.challenge.id,
          stringIndex: state.challenge.stringIndex,
          fret: state.challenge.fret,
          // Triade et parcours de gamme : même langage visuel, vert acide.
          variant: state.challenge.assist
            ? ('assist' as const)
            : state.challenge.triad || state.challenge.scale
              ? ('triad' as const)
              : ('default' as const),
          // Chaque note de la triade, à son tour, égrène son délai autour du point ;
          // l'anneau vide passe au gris : le « ×2 » est perdu pour cette note.
          ...(state.challenge.triad && state.triad
            ? {
                countdownMs: TRIAD_RULES.fastReactionMs,
                countdownEndsAt: (state.challengeShownAt ?? 0) + TRIAD_RULES.fastReactionMs,
                countdownSpent: !ringRunning,
              }
            : {}),
        }
      : null

  // Notes en filigrane. Triade : celles pas encore demandées (pendant une
  // révélation, `locked`, la suivante attend encore son tour). Parcours de
  // gamme : toute la forme, sauf la note à deviner ; elle se dessine du grave
  // à l'aigu à son ouverture, puis chaque note jouée prend sa couleur.
  const triad = playing ? state.triad : null
  const run = playing ? state.scaleRun : null
  const locked = state.locked
  const ghosts = useMemo<readonly FretboardGhost[]>(() => {
    if (run) {
      const drawing = run.outcomes.length === 0 && locked
      return run.notes.flatMap((note, i) => {
        if (i === run.step && !locked) return []
        const outcome = run.outcomes[i]
        return [
          {
            key: `${note.stringIndex}:${note.fret}`,
            stringIndex: note.stringIndex,
            fret: note.fret,
            tone: outcome ?? (run.accents.includes(i) ? 'triad' : 'plain'),
            delay: drawing ? i * 0.07 : 0,
          },
        ]
      })
    }
    if (!triad) return NO_GHOSTS
    return triad.notes.slice(locked ? triad.step : triad.step + 1).map((note) => ({
      key: `${note.stringIndex}:${note.fret}`,
      stringIndex: note.stringIndex,
      fret: note.fret,
      tone: 'triad' as const,
    }))
  }, [run, triad, locked])

  // Impact physique du manche, à chaque tentative.
  const { ref: boardRef, impact } = useBoardImpact()
  useEffect(
    () => game.events.on('guess', (result) => impact(result.correct)),
    [game.events, impact],
  )
  const box = orientViewBox(layout.viewBox, orientation)
  const { mainRef, pianoRef, maxWidth: boardMaxWidth } = useBoardFit(box.width / box.height)

  // L'aura du combo passe sous les révélations.
  const comboActive = playing && state.combo !== null
  const overlay = useCallback(
    (projection: BoardProjection) => (
      <>
        <ComboAura active={comboActive} layout={layout} projection={projection} />
        <RevealLayer result={state.lastResult} layout={layout} projection={projection} />
      </>
    ),
    [comboActive, state.lastResult, layout],
  )

  return (
    <div data-slot="game-screen" className={cn('flex h-dvh flex-col overflow-hidden', className)}>
      <LevelHud state={state} triadBoost={ringRunning} leading={modeSwitch} className="shrink-0" />
      <main
        ref={mainRef}
        data-slot="game-stage"
        data-orientation={orientation}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1rem,6vh,4.5rem)] px-4 pt-2 pb-[clamp(0.75rem,3vh,1.5rem)]"
      >
        <div
          ref={boardRef}
          data-slot="game-board"
          data-combo={comboActive || undefined}
          className="relative w-full"
          style={{ maxWidth: boardMaxWidth }}
        >
          <Fretboard
            layout={layout}
            marker={marker}
            ghosts={ghosts}
            overlay={overlay}
            orientation={orientation}
          />
          <StartCountdown state={state} />
        </div>
        {/* Hors partie, le piano sort du parcours clavier et de l'arbre d'accessibilité. */}
        <div ref={pianoRef} data-slot="game-piano" className="w-full" inert={!playing}>
          <Piano
            onPress={game.guess}
            pressed={pressed}
            sharpMode={sharpMode}
            feedback={feedback}
            nudge={nudge}
            disabled={!playing}
          />
        </div>
        {/* Annonces empilées au-dessus du manche : deux peuvent se croiser sans se masquer. */}
        <div
          data-slot="stage-banners"
          className="pointer-events-none absolute top-2 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5 short:top-0.5 short:gap-1"
        >
          <AssistBanner assist={playing ? state.assist : null} />
          <TriadBanner outcome={playing ? state.lastTriad : null} />
          <ScaleBanner outcome={playing ? state.lastScaleRun : null} />
        </div>
        {/* Annonce d'une triade : la partie est en pause le temps qu'elle passe. */}
        <TriadIntro intro={playing ? state.triadIntro : null} />
        <LevelOverlay
          state={state}
          visible={overlayVisible}
          hasNextLevel={game.hasNextLevel}
          onStart={game.start}
          onNextLevel={game.nextLevel}
        />
      </main>
    </div>
  )
}
