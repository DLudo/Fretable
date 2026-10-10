import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Fretboard } from '@/components/game/fretboard'
import { PORTRAIT_QUERY, useBoardFit } from '@/components/game/useBoardFit'
import { useBoardImpact } from '@/components/game/useBoardImpact'
import { RevealLayer } from '@/effects'
import { BOSS_RULES } from '@/game/config'
import { useBossGame, type BossJudgement, type BossState } from '@/game/boss'
import type { GuessResult } from '@/game/engine/types'
import { createNeckLayout } from '@/game/fretboard/geometry'
import {
  orientViewBox,
  type BoardOrientation,
  type BoardProjection,
} from '@/game/fretboard/projection'
import { useKeyboardControls } from '@/game/input/useKeyboardControls'
import { stringNumber } from '@/game/music/tuning'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { BossHud } from './BossHud'
import { BossLayer } from './BossLayer'
import { BossOverlay } from './BossOverlay'

/** L'écran de fin attend que le dernier jugement ait pu être lu (ms). */
const END_SCREEN_DELAY_MS = 900

/**
 * Temps de réaction prêté à chaque jugement pour la révélation : les effets du
 * mode classique s'emballent sur les réponses rapides (coup critique sous 0,5 s).
 */
const REVEAL_REACTION_MS: Record<BossJudgement, number | null> = {
  perfect: 400,
  great: 900,
  good: 1800,
  wrong: 1800,
  miss: null,
}

const isSuccess = (judgement: BossJudgement) =>
  judgement === 'perfect' || judgement === 'great' || judgement === 'good'

/**
 * Dernier jugement du boss, traduit en tentative du mode classique : la même
 * révélation (étiquette de la note, effet, intensité selon la série) se joue
 * sur la cible. Un raté s'y lit comme un temps écoulé, la bonne note révélée.
 */
function revealResultOf({
  lastHit: hit,
  notes,
  combo,
}: Pick<BossState, 'lastHit' | 'notes' | 'combo'>): GuessResult | null {
  if (!hit) return null
  const { id, stringIndex, fret, pc } = notes[hit.index]
  const correct = isSuccess(hit.judgement)
  const points = correct ? BOSS_RULES.points[hit.judgement as 'perfect' | 'great' | 'good'] : 0
  return {
    id: Math.round(hit.at),
    challenge: { id, stringIndex, fret, pc },
    guess: hit.guess,
    correct,
    streak: correct ? combo : 0,
    at: hit.at,
    reactionMs: REVEAL_REACTION_MS[hit.judgement],
    basePoints: points,
    multiplier: 1,
    points,
    comboTriggered: false,
    assisted: false,
  }
}

export interface BossScreenProps {
  /** Interrupteur de mode, posé en tête du HUD. */
  modeSwitch?: ReactNode
  className?: string
}

/**
 * Écran du boss final : HUD avec barre de vie, et le manche seul, sans piano :
 * le combat se joue au clavier, pour laisser toute la hauteur aux fantômes qui
 * montent du bas de l'écran. Toute la logique vit dans `useBossGame`.
 */
export function BossScreen({ modeSwitch, className }: BossScreenProps) {
  const boss = useBossGame()
  const { state, start, press } = boss
  const playing = state.phase === 'playing'
  const layout = useMemo(() => createNeckLayout({ tuning: boss.tuning }), [boss.tuning])
  const orientation: BoardOrientation = useMediaQuery(PORTRAIT_QUERY) ? 'vertical' : 'horizontal'
  const box = orientViewBox(layout.viewBox, orientation)
  const { mainRef, maxWidth } = useBoardFit(box.width / box.height)

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
  useKeyboardControls({ onNote: press, onConfirm: confirm })

  // Mêmes retours qu'en mode classique : impact du manche et révélation de la note.
  const { ref: boardRef, impact } = useBoardImpact()
  const lastHit = state.lastHit
  useEffect(() => {
    if (lastHit) impact(isSuccess(lastHit.judgement))
  }, [lastHit, impact])
  // Dernier jugement, série et notes changent ensemble : une révélation par jugement.
  const { notes, combo } = state
  const reveal = useMemo(() => revealResultOf({ lastHit, notes, combo }), [lastHit, notes, combo])

  const overlay = useCallback(
    (projection: BoardProjection) => (
      <>
        <BossLayer state={state} layout={layout} projection={projection} />
        <RevealLayer result={reveal} layout={layout} projection={projection} />
      </>
    ),
    [state, reveal, layout],
  )

  const next = playing ? state.notes[state.cursor] : undefined

  return (
    <div data-slot="boss-screen" className={cn('flex h-dvh flex-col overflow-hidden', className)}>
      <BossHud state={state} leading={modeSwitch} className="shrink-0" />
      <main
        ref={mainRef}
        data-slot="game-stage"
        data-orientation={orientation}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pt-2 pb-[clamp(0.75rem,3vh,1.5rem)]"
      >
        <div ref={boardRef} data-slot="game-board" className="relative w-full" style={{ maxWidth }}>
          <Fretboard layout={layout} marker={null} overlay={overlay} orientation={orientation} />
        </div>
        <p className="sr-only" aria-live="polite">
          {next
            ? `Note suivante : corde ${stringNumber(boss.tuning, next.stringIndex)}, case ${next.fret}`
            : ''}
        </p>
        <BossOverlay state={state} visible={overlayVisible} onStart={start} />
      </main>
    </div>
  )
}
