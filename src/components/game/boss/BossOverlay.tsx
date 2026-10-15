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
  RatingStars,
  ScoreLine,
  Stat,
} from '@/components/game/overlays'
import { CoinBalance, CoinConversion } from '@/components/game/coins'
import { formatLife } from '@/components/game/hud'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import type { CoinReceipt } from '@/game/coins'
import { BOSS_RULES } from '@/game/config'
import { rateBossFight, type BossJudgement, type BossState } from '@/game/boss'
import { cn } from '@/lib/utils'

export interface BossOverlayProps {
  state: BossState
  /** `false` tant que les derniers retours se jouent (délai de fin géré par le parent). */
  visible: boolean
  /** Pièces créditées pour le combat fini (conversion du score, prime d'étoiles sur une victoire). */
  coins?: CoinReceipt | null
  onStart: () => void
  className?: string
}

/**
 * Écrans d'avant et d'après combat (prêt, vaincu, K.O.), posés sur le jeu :
 * le parent doit être `relative`. Rien n'est rendu pendant le combat.
 */
export function BossOverlay({
  state,
  visible,
  coins = null,
  onStart,
  className,
}: BossOverlayProps): ReactNode {
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
              <EndPanel state={state} coins={coins} onStart={onStart} />
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
          Trop tôt, la frappe ne compte pas. Chaque réussite blesse le boss et te rend un peu de vie
          : touche-le {BOSS_RULES.bossLife} fois pour le vaincre. Une note manquée ne l'entame pas
          et te coûte de la vie, une erreur davantage ; le combat dure tant qu'il tient debout. Des
          notes bonus, jaunes et plus rapides, s'intercalent parfois : frappées, elles valent le
          triple de points, sans blesser le boss ni rendre de vie ; une fausse touche s'y rattrape
          une fois, et manquées ou fausses, elles ne coûtent rien.
        </p>
        <p className="pointer-coarse:hidden short:hidden">Pas de piano ici : joue au clavier.</p>
        <p className="hidden pointer-coarse:block">
          Le boss se joue au clavier : pas de piano tactile dans ce mode.
        </p>
        <KeyboardMap onTouch />
        <CoinBalance className="mt-1" />
      </div>
    </Panel>
  )
}

/** Notes du boss (hors bonus) jugées ainsi. */
function count(state: BossState, ...judgements: BossJudgement[]): number {
  return state.hits.filter(
    (hit, i) => hit !== null && !state.notes[i].bonus && judgements.includes(hit.judgement),
  ).length
}

/** Notes bonus frappées, sur celles jouées (jugées) pendant le combat. */
function bonusTally(state: BossState): string {
  let hits = 0
  let played = 0
  state.hits.forEach((hit, i) => {
    if (hit === null || !state.notes[i].bonus) return
    played++
    if (hit.points > 0) hits++
  })
  return `${hits} / ${played}`
}

function EndPanel({
  state,
  coins,
  onStart,
}: {
  state: BossState
  coins: CoinReceipt | null
  onStart: () => void
}) {
  const won = state.phase === 'won'
  return (
    <Panel
      title={won ? 'Boss vaincu !' : 'K.O.'}
      description={
        won
          ? `Vie restante : ${formatLife(state.life)} sur ${BOSS_RULES.life.max}`
          : `Le boss tenait encore : ${state.bossLife} ${state.bossLife > 1 ? 'coups' : 'coup'} à lui porter sur ${BOSS_RULES.bossLife}.`
      }
      actions={
        <Button size="lg" className="w-full" autoFocus onClick={blurThen(onStart)}>
          <RotateCcw />
          {won ? 'Rejouer' : 'Réessayer'}
        </Button>
      }
    >
      {/* Victoire : étoiles au-dessus du score, comme à la fin d'un niveau ; sur écran
          peu haut, à sa droite pour gagner une ligne. */}
      <div
        data-slot="boss-overlay-result"
        className={cn(
          'flex flex-col gap-4',
          won && 'compact:flex-row-reverse compact:items-center compact:justify-between',
          !coins && 'mb-4',
        )}
      >
        {won && <RatingStars rating={rateBossFight(state)} />}
        <ScoreLine score={state.score} />
      </div>
      {coins && (
        <CoinConversion
          receipt={coins}
          // Sur une victoire, la conversion attend que les étoiles se posent.
          delay={won ? 1 : 0.45}
          className="mt-3 mb-4 compact:mt-2 compact:mb-3"
        />
      )}
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
      <dl data-slot="boss-overlay-bonus" className="mt-2 grid grid-cols-1 rounded-lg border">
        <Stat label="Notes bonus" value={bonusTally(state)} />
      </dl>
    </Panel>
  )
}
