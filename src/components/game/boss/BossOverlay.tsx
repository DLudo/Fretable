import { type ReactNode } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Play, RotateCcw, Skull } from 'lucide-react'

import {
  blurThen,
  ENTER,
  KeyboardMap,
  LEAVE,
  Panel,
  PresenceLayer,
  ScoreLine,
  Stat,
} from '@/components/game/overlays'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { BOSS_RULES } from '@/game/config'
import type { BossJudgement, BossState } from '@/game/boss'
import { cn } from '@/lib/utils'

export interface BossOverlayProps {
  state: BossState
  /** `false` tant que les derniers retours se jouent (délai de fin géré par le parent). */
  visible: boolean
  onStart: () => void
  className?: string
}

/**
 * Écrans d'avant et d'après combat (prêt, vaincu, K.O.), posés sur le jeu :
 * le parent doit être `relative`. Rien n'est rendu pendant le combat.
 */
export function BossOverlay({ state, visible, onStart, className }: BossOverlayProps): ReactNode {
  const reduceMotion = useReducedMotion()
  const { phase } = state
  const open = visible && phase !== 'playing'
  return (
    <AnimatePresence>
      {open && (
        <PresenceLayer
          key="boss-overlay"
          data-slot="boss-overlay"
          data-phase={phase}
          className={cn(
            'absolute inset-0 z-50 flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm',
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: ENTER }}
          exit={{ opacity: 0, transition: LEAVE }}
        >
          <PresenceLayer
            key={phase}
            className="m-auto w-full max-w-sm"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: ENTER }}
          >
            {phase === 'ready' ? (
              <ReadyPanel onStart={onStart} />
            ) : (
              <EndPanel state={state} onStart={onStart} />
            )}
          </PresenceLayer>
        </PresenceLayer>
      )}
    </AnimatePresence>
  )
}

function ReadyPanel({ onStart }: { onStart: () => void }) {
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Skull aria-hidden className="size-5 text-feedback-error" />
          Boss final
        </span>
      }
      description="Frappe chaque note quand le fantôme atteint sa cible."
      describeContent
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
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>
          Trop tôt, la frappe ne compte pas. Une note manquée coûte de la vie, une erreur davantage
          ; chaque réussite en rend un peu. Survis aux {BOSS_RULES.noteCount} notes pour vaincre le
          boss.
        </p>
        <p className="pointer-coarse:hidden short:hidden">Pas de piano ici : joue au clavier.</p>
        <p className="hidden pointer-coarse:block">
          Le boss se joue au clavier d’ordinateur : pas de piano tactile dans ce mode.
        </p>
        <KeyboardMap />
      </div>
    </Panel>
  )
}

function count(state: BossState, ...judgements: BossJudgement[]): number {
  return state.hits.filter((hit) => hit !== null && judgements.includes(hit.judgement)).length
}

function EndPanel({ state, onStart }: { state: BossState; onStart: () => void }) {
  const won = state.phase === 'won'
  return (
    <Panel
      title={won ? 'Boss vaincu !' : 'K.O.'}
      description={
        won
          ? `Vie restante : ${Math.round(state.life)} sur ${BOSS_RULES.life.max}`
          : `Le boss t'a eu à la note ${state.cursor} sur ${state.notes.length}.`
      }
      actions={
        <Button size="lg" className="w-full" autoFocus onClick={blurThen(onStart)}>
          <RotateCcw />
          {won ? 'Rejouer' : 'Réessayer'}
        </Button>
      }
    >
      <ScoreLine score={state.score} className="mb-4" />
      <dl data-slot="boss-overlay-stats" className="grid grid-cols-3 divide-x rounded-lg border">
        <Stat label="Parfait" value={count(state, 'perfect')} />
        <Stat label="Super" value={count(state, 'great')} />
        <Stat label="Bien" value={count(state, 'good')} />
      </dl>
      <dl className="mt-2 grid grid-cols-3 divide-x rounded-lg border">
        <Stat label="Erreurs" value={count(state, 'wrong')} />
        <Stat label="Ratés" value={count(state, 'miss')} />
        <Stat label="Meilleure série" value={state.bestCombo} />
      </dl>
    </Panel>
  )
}
