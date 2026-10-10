import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Fretboard } from '@/components/game/fretboard'
import { Piano, type PianoFeedback } from '@/components/game/piano'
import { PORTRAIT_QUERY, useBoardFit } from '@/components/game/useBoardFit'
import { BOSS_RULES } from '@/game/config'
import { useBossGame } from '@/game/boss'
import { createNeckLayout } from '@/game/fretboard/geometry'
import {
  orientViewBox,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { useKeyboardControls } from '@/game/input/useKeyboardControls'
import type { PitchClass } from '@/game/music/notes'
import { stringNumber } from '@/game/music/tuning'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { BossHud } from './BossHud'
import { BossLayer } from './BossLayer'
import { BossOverlay } from './BossOverlay'

/** L'écran de fin attend que le dernier jugement ait pu être lu (ms). */
const END_SCREEN_DELAY_MS = 900

export interface BossScreenProps {
  /** Interrupteur de mode, posé en tête du HUD. */
  modeSwitch?: ReactNode
  className?: string
}

/**
 * Écran du boss final : HUD avec barre de vie, manche aux couloirs et
 * fantômes, piano. Toute la logique vit dans `useBossGame`.
 */
export function BossScreen({ modeSwitch, className }: BossScreenProps) {
  const boss = useBossGame()
  const { state, start, press } = boss
  const playing = state.phase === 'playing'
  // Sous le manche, la zone de lancement des fantômes (sous les numéros de cases).
  const layout = useMemo(
    () => createNeckLayout({ tuning: boss.tuning, padding: { bottom: BOSS_RULES.launchMm + 4 } }),
    [boss.tuning],
  )
  const orientation: BoardOrientation = useMediaQuery(PORTRAIT_QUERY) ? 'vertical' : 'horizontal'
  const box = orientViewBox(layout.viewBox, orientation)
  const { mainRef, pianoRef, maxWidth } = useBoardFit(box.width / box.height)

  const [overlayFor, setOverlayFor] = useState<number | null>(null)
  useEffect(() => {
    const endedAt = state.endedAt
    if (endedAt === null) return
    const timer = window.setTimeout(
      () => setOverlayFor(endedAt),
      Math.max(0, endedAt + END_SCREEN_DELAY_MS - performance.now()),
    )
    return () => window.clearTimeout(timer)
  }, [state.endedAt])
  const overlayVisible = state.phase === 'ready' || overlayFor === state.endedAt

  const confirm = () => {
    if (overlayVisible && !playing) start()
  }

  const [nudge, setNudge] = useState<{ id: number; pc: PitchClass } | null>(null)
  const nudgeId = useRef(0)
  const { sharpMode, pressed } = useKeyboardControls({
    onNote: press,
    onNoSharp: (pc) => setNudge({ id: ++nudgeId.current, pc }),
    onConfirm: confirm,
  })

  // Retour sur le piano : la touche jouée, et la bonne note quand elle a été manquée.
  const feedback = useMemo<PianoFeedback | null>(() => {
    const hit = state.lastHit
    if (!hit) return null
    return {
      id: Math.round(hit.at),
      guess: hit.guess,
      answer: state.notes[hit.index].pc,
      correct: hit.judgement !== 'wrong' && hit.judgement !== 'miss',
    }
  }, [state.lastHit, state.notes])

  const overlay = useCallback(
    (projection: BoardProjection) => (
      <BossLayer state={state} layout={layout} projection={projection} />
    ),
    [state, layout],
  )

  const next = playing ? state.notes[state.cursor] : undefined

  return (
    <div data-slot="boss-screen" className={cn('flex h-dvh flex-col overflow-hidden', className)}>
      <BossHud state={state} leading={modeSwitch} className="shrink-0" />
      <main
        ref={mainRef}
        data-slot="game-stage"
        data-orientation={orientation}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1rem,6vh,4.5rem)] px-4 pt-2 pb-[clamp(0.75rem,3vh,1.5rem)]"
      >
        <div data-slot="game-board" className="relative w-full" style={{ maxWidth }}>
          <Fretboard layout={layout} marker={null} overlay={overlay} orientation={orientation} />
        </div>
        <p className="sr-only" aria-live="polite">
          {next
            ? `Note suivante : corde ${stringNumber(boss.tuning, next.stringIndex)}, case ${next.fret}`
            : ''}
        </p>
        {/* Hors combat, le piano sort du parcours clavier et de l'arbre d'accessibilité. */}
        <div ref={pianoRef} data-slot="game-piano" className="w-full" inert={!playing}>
          <Piano
            onPress={press}
            pressed={pressed}
            sharpMode={sharpMode}
            feedback={feedback}
            nudge={nudge}
            disabled={!playing}
          />
        </div>
        <BossOverlay state={state} visible={overlayVisible} onStart={start} />
      </main>
    </div>
  )
}
