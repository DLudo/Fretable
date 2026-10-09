import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAnimate, useReducedMotion, type Transition } from 'motion/react'

import { RevealLayer } from '@/effects'
import { ComboAura } from '@/effects/ambient'
import type { GameEventBus } from '@/game/engine/events'
import { endScreenAt } from '@/game/engine/selectors'
import { useGame } from '@/game/engine/useGame'
import { createNeckLayout } from '@/game/fretboard/geometry'
import {
  orientViewBox,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { useKeyboardControls } from '@/game/input/useKeyboardControls'
import type { PitchClass } from '@/game/music/notes'
import { useElementSize } from '@/hooks/useElementSize'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'
import { AssistBanner } from './AssistBanner'
import { Fretboard } from './fretboard'
import { LevelHud } from './hud'
import { LevelOverlay } from './overlays'
import { Piano, type PianoFeedback } from './piano'
import { StartCountdown } from './StartCountdown'

/** Largeur maximale du manche sur grand écran. */
const BOARD_MAX_WIDTH = '72rem'

/** Téléphone tenu en portrait : le manche passe à la verticale (sillet en haut). */
const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 639px)'

/** Petit coup sec du manche sur une bonne réponse. */
const BOARD_HIT: Transition = { duration: duration.fast, ease: ease.outQuart }
/** Secousse latérale sur une erreur. */
const BOARD_SHAKE: Transition = { duration: duration.base, ease: ease.outQuart }

export interface GameScreenProps {
  className?: string
}

/**
 * Écran de jeu : assemble HUD, manche, piano, révélations et overlays.
 * Toute la logique vit dans `useGame` ; ce composant ne fait que du câblage.
 */
export function GameScreen({ className }: GameScreenProps) {
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

  const marker =
    playing && !state.locked && state.challenge
      ? {
          id: state.challenge.id,
          stringIndex: state.challenge.stringIndex,
          fret: state.challenge.fret,
          variant: state.challenge.assist ? ('assist' as const) : ('default' as const),
        }
      : null

  const boardRef = useBoardImpact(game.events)
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
      <LevelHud state={state} className="shrink-0" />
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
          <Fretboard layout={layout} marker={marker} overlay={overlay} orientation={orientation} />
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
        <AssistBanner assist={playing ? state.assist : null} />
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

/**
 * Le manche est dimensionné par la largeur, mais jamais plus haut que l'espace
 * laissé par le HUD et le piano (proportions conservées). `aspectRatio` est
 * celui du manche orienté : à la verticale, c'est donc la hauteur disponible
 * qui fixe sa taille.
 */
function useBoardFit(aspectRatio: number) {
  const [mainRef, main] = useElementSize<HTMLElement>()
  const [pianoRef, piano] = useElementSize<HTMLDivElement>()
  const [chrome, setChrome] = useState(0)

  // Marges verticales et espacement du conteneur, relus avant affichage quand sa taille change.
  useLayoutEffect(() => {
    const element = mainRef.current
    if (!element) return
    const style = getComputedStyle(element)
    setChrome(
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.rowGap),
    )
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
function useBoardImpact(events: GameEventBus) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    return events.on('guess', (result) => {
      if (!scope.current) return
      if (result.correct) animate(scope.current, { y: [0, 3, 0] }, BOARD_HIT)
      else animate(scope.current, { x: [0, -7, 6, -4, 3, -1, 0] }, BOARD_SHAKE)
    })
  }, [events, animate, scope, reduced])
  return scope
}
