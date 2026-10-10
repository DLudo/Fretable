import { type ReactNode } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowBigUp, ArrowRight, Play, RotateCcw } from 'lucide-react'

import { clockResolutionOf, formatClock, formatDurationWords } from '@/components/game/hud'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { NOTATION } from '@/game/config'
import { rateGame } from '@/game/engine/rating'
import { playedMs } from '@/game/engine/selectors'
import { remainingMs } from '@/game/engine/useCountdown'
import type { GameState } from '@/game/engine/types'
import { keyHint } from '@/game/input/keymap'
import { NATURAL_PCS, noteName } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { blurThen, ENTER, LEAVE, Panel, PresenceLayer, ScoreLine, Stat } from './panel'
import { RatingStars } from './RatingStars'

export interface LevelOverlayProps {
  state: GameState
  /** `false` tant que la dernière révélation se joue (délai de fin géré par le parent). */
  visible: boolean
  /** Affiche « Niveau suivant » sur l'écran de victoire. */
  hasNextLevel: boolean
  /** Lance ou relance le niveau courant. */
  onStart: () => void
  /** Charge le niveau suivant (écran « prêt »). */
  onNextLevel: () => void
  className?: string
}

/**
 * Écrans d'avant et d'après niveau (prêt, réussi, temps écoulé), posés sur le
 * jeu : le parent doit être `relative`. Rien n'est rendu pendant la partie.
 */
export function LevelOverlay({
  state,
  visible,
  hasNextLevel,
  onStart,
  onNextLevel,
  className,
}: LevelOverlayProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const { phase } = state
  // Ni pendant la partie, ni pendant le décompte qui la précède.
  const open = visible && (phase === 'ready' || phase === 'won' || phase === 'lost')

  return (
    <AnimatePresence>
      {open && (
        <PresenceLayer
          key="level-overlay"
          data-slot="level-overlay"
          data-phase={phase}
          className={cn(
            'absolute inset-0 z-50 flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm',
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: ENTER }}
          exit={{ opacity: 0, transition: LEAVE }}
        >
          {/* Le panneau change sans refaire le fond (réussi → niveau suivant). */}
          <AnimatePresence mode="wait">
            <PresenceLayer
              key={`${state.levelIndex}:${phase}`}
              data-slot="level-overlay-panel"
              className="m-auto w-full max-w-sm"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: ENTER }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: LEAVE }
                  : { opacity: 0, scale: 0.98, transition: LEAVE }
              }
            >
              {phase === 'won' ? (
                <WonPanel
                  state={state}
                  hasNextLevel={hasNextLevel}
                  onStart={onStart}
                  onNextLevel={onNextLevel}
                />
              ) : phase === 'lost' ? (
                <LostPanel state={state} onStart={onStart} />
              ) : (
                <ReadyPanel state={state} onStart={onStart} />
              )}
            </PresenceLayer>
          </AnimatePresence>
        </PresenceLayer>
      )}
    </AnimatePresence>
  )
}

interface PanelProps {
  state: GameState
  onStart: () => void
}

function ReadyPanel({ state, onStart }: PanelProps) {
  const { level } = state
  return (
    <Panel
      title={level.title}
      description={`Trouve ${level.targetCount} notes en ${formatDurationWords(level.durationMs)}.`}
      actions={
        <>
          <Button size="lg" className="w-full" autoFocus onClick={blurThen(onStart)}>
            <Play />
            Commencer
          </Button>
          <p className="text-xs text-muted-foreground pointer-coarse:hidden short:hidden">
            ou appuie sur <Kbd>Entrée</Kbd>
          </p>
        </>
      }
    >
      <div
        data-slot="level-overlay-controls"
        className="flex flex-col gap-3 text-sm text-muted-foreground"
      >
        <p className="pointer-coarse:hidden short:hidden">
          Clique sur le piano ou joue au clavier :
        </p>
        <p className="hidden pointer-coarse:block">Touche le piano pour répondre.</p>
        <dl
          data-slot="level-overlay-keymap"
          className="grid grid-cols-7 gap-1 pointer-coarse:hidden"
        >
          {NATURAL_PCS.map((pc) => (
            <div key={pc} className="flex flex-col items-center gap-1.5">
              <dt>
                <Kbd className="h-6 min-w-6 font-mono text-foreground">{keyHint(pc)}</Kbd>
              </dt>
              <dd className="text-xs">{noteName(pc, NOTATION)}</dd>
            </div>
          ))}
        </dl>
        <p className="pointer-coarse:hidden">
          Maintiens{' '}
          <Kbd>
            <ArrowBigUp aria-hidden className="size-3.5" strokeWidth={2.25} />
            Maj
          </Kbd>{' '}
          pour jouer le dièse.
        </p>
      </div>
    </Panel>
  )
}

function WonPanel({
  state,
  hasNextLevel,
  onStart,
  onNextLevel,
}: PanelProps & { hasNextLevel: boolean; onNextLevel: () => void }) {
  const { level, endedAt } = state
  // Temps de jeu, pauses déduites, à la précision du minuteur figé du HUD :
  // les deux totalisent la durée du niveau (temps accordé en plus).
  const elapsed = playedMs(state)
  const resolution = clockResolutionOf(remainingMs(state, endedAt ?? 0), 'ceil')
  return (
    <Panel
      title={'Niveau réussi\u00a0!'}
      description={`${level.title} · ${level.targetCount} notes trouvées`}
      actions={
        hasNextLevel ? (
          <>
            <Button size="lg" className="w-full" autoFocus onClick={blurThen(onNextLevel)}>
              Niveau suivant
              <ArrowRight />
            </Button>
            <Button variant="outline" className="w-full" onClick={blurThen(onStart)}>
              <RotateCcw />
              Rejouer
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" className="w-full" autoFocus onClick={blurThen(onStart)}>
              <RotateCcw />
              Rejouer
            </Button>
            <p className="text-xs text-muted-foreground">D’autres niveaux arrivent bientôt.</p>
          </>
        )
      }
    >
      {/* Étoiles au-dessus du score ; sur écran peu haut, à sa droite pour gagner une ligne. */}
      <div
        data-slot="level-overlay-result"
        className="mb-4 flex flex-col gap-4 compact:flex-row-reverse compact:items-center compact:justify-between"
      >
        <RatingStars rating={rateGame(state)} />
        <ScoreLine score={state.score} />
      </div>
      <dl data-slot="level-overlay-stats" className="grid grid-cols-3 divide-x rounded-lg border">
        {/* Tronqué : avec le minuteur du HUD (arrondi au-dessus), le total fait la durée du niveau. */}
        <Stat label="Temps" value={formatClock(elapsed, 'floor', resolution)} />
        <Stat label="Erreurs" value={state.mistakes} />
        <Stat label="Meilleure série" value={state.bestStreak} />
      </dl>
    </Panel>
  )
}

function LostPanel({ state, onStart }: PanelProps) {
  const { level, correctCount, lastResult } = state
  // Note restée sans réponse à la fin du temps : on la nomme, pour que l'essai serve.
  const missed = lastResult?.guess === null ? lastResult.challenge : null
  return (
    <Panel
      title="Temps écoulé"
      description={`${correctCount} / ${level.targetCount} notes trouvées`}
      describeContent
      actions={
        <Button size="lg" className="w-full" autoFocus onClick={blurThen(onStart)}>
          <RotateCcw />
          Réessayer
        </Button>
      }
    >
      <ScoreLine score={state.score} className={missed ? 'mb-2' : undefined} />
      {missed && (
        <p data-slot="level-overlay-missed" className="text-sm text-muted-foreground">
          La note était{' '}
          <strong data-slot="level-overlay-missed-note" className="font-semibold text-foreground">
            {noteName(missed.pc, NOTATION)}
          </strong>
        </p>
      )}
    </Panel>
  )
}
