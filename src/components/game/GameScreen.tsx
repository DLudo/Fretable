import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAnimate, useReducedMotion } from 'motion/react'
import { RotateCcw } from 'lucide-react'

import { RevealLayer } from '@/effects'
import { GAME_FEEL } from '@/game/config'
import { useGame } from '@/game/engine/useGame'
import { createNeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { useKeyboardControls } from '@/game/input/useKeyboardControls'
import type { PitchClass } from '@/game/music/notes'
import { useElementSize } from '@/hooks/useElementSize'
import { ease } from '@/theme/motion'
import { Fretboard } from './fretboard/Fretboard'
import { LevelHud } from './hud'
import { LevelOverlay } from './overlays'
import { Piano, type PianoFeedback } from './piano'

/**
 * Écran de jeu : assemble HUD, manche, piano, révélations et overlays.
 * Toute la logique vit dans `useGame` ; ce composant ne fait que du câblage.
 */
export function GameScreen() {
  const game = useGame()
  const { state } = game
  const layout = useMemo(() => createNeckLayout({ tuning: game.tuning }), [game.tuning])
  const playing = state.phase === 'playing'

  // L'écran de victoire attend la fin de la dernière révélation.
  const [victoryShownFor, setVictoryShownFor] = useState<number | null>(null)
  useEffect(() => {
    if (state.phase !== 'won' || state.endedAt === null) return
    const endedAt = state.endedAt
    const timer = window.setTimeout(() => setVictoryShownFor(endedAt), GAME_FEEL.victoryDelayMs)
    return () => window.clearTimeout(timer)
  }, [state.phase, state.endedAt])
  const overlayVisible = state.phase !== 'won' || victoryShownFor === state.endedAt

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
    return { id: result.id, guess: result.guess, answer: result.challenge.pc, correct: result.correct }
  }, [state.lastResult])

  const marker =
    playing && !state.locked && state.challenge
      ? { id: state.challenge.id, stringIndex: state.challenge.stringIndex, fret: state.challenge.fret }
      : null

  const boardRef = useBoardImpact(game.events)
  const { mainRef, pianoRef, maxWidth: boardMaxWidth } = useBoardFit(
    layout.viewBox.width / layout.viewBox.height,
  )

  const overlay = useCallback(
    (projection: BoardProjection) => (
      <RevealLayer result={state.lastResult} layout={layout} projection={projection} />
    ),
    [state.lastResult, layout],
  )

  return (
    <div data-slot="game-screen" className="flex h-dvh flex-col overflow-hidden">
      <LevelHud state={state} className="shrink-0" />
      <main
        ref={mainRef}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1rem,6vh,4.5rem)] px-4 pt-2 pb-[clamp(0.75rem,3vh,1.5rem)]"
      >
        <div className="flex w-full flex-col items-center gap-2">
          <div ref={boardRef} className="w-full" style={{ maxWidth: boardMaxWidth }}>
            <Fretboard layout={layout} marker={marker} overlay={overlay} />
          </div>
          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground max-sm:portrait:flex">
            <RotateCcw className="size-3.5" aria-hidden />
            En paysage, le manche est plus grand.
          </p>
        </div>
        <div ref={pianoRef} className="w-full">
          <Piano
            onPress={game.guess}
            pressed={pressed}
            sharpMode={sharpMode}
            feedback={feedback}
            nudge={nudge}
            disabled={!playing}
          />
        </div>
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

/** Largeur maximale du manche sur grand écran. */
const BOARD_MAX_WIDTH = '72rem'

/**
 * Le manche est dimensionné par la largeur… sauf sur les écrans bas (mobile en
 * paysage) : on borne alors sa largeur pour que sa hauteur tienne dans
 * l'espace laissé par le HUD et le piano, proportions conservées.
 */
function useBoardFit(aspectRatio: number) {
  const [mainRef, main] = useElementSize<HTMLElement>()
  const [pianoRef, piano] = useElementSize<HTMLDivElement>()
  const [chrome, setChrome] = useState(0)

  // Marges verticales et espacement du conteneur, relus quand sa taille change.
  useEffect(() => {
    const element = mainRef.current
    if (!element) return
    const style = getComputedStyle(element)
    setChrome(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.rowGap))
  }, [mainRef, main.height])

  const available = main.height - piano.height - chrome
  const maxWidth =
    main.height > 0 && available > 0
      ? `min(${BOARD_MAX_WIDTH}, ${Math.floor(available * aspectRatio)}px)`
      : BOARD_MAX_WIDTH
  return { mainRef, pianoRef, maxWidth }
}

/**
 * Impact physique du manche : petit coup sec sur une bonne réponse,
 * secousse sur une erreur. Branché sur le bus d'événements du jeu.
 */
function useBoardImpact(events: ReturnType<typeof useGame>['events']) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    return events.on('guess', (result) => {
      if (!scope.current) return
      if (result.correct) {
        animate(scope.current, { y: [0, 3, 0] }, { duration: 0.16, ease: ease.outQuart })
      } else {
        animate(scope.current, { x: [0, -7, 6, -4, 3, -1, 0] }, { duration: 0.32, ease: 'easeOut' })
      }
    })
  }, [events, animate, scope, reduced])
  return scope
}
