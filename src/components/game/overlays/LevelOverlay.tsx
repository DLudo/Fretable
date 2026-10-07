import { useId, type ComponentProps, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Transition,
} from 'motion/react'
import { ArrowRight, Play, RotateCcw } from 'lucide-react'

import { formatSeconds } from '@/components/game/hud/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Kbd } from '@/components/ui/kbd'
import { NOTATION } from '@/game/config'
import type { GameState } from '@/game/engine/types'
import { keyHint } from '@/game/input/keymap'
import { NATURAL_PCS, noteName } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'

export interface LevelOverlayProps {
  state: GameState
  /** false while the final reveal is still playing (victory delay handled by the parent). */
  visible: boolean
  hasNextLevel: boolean
  /** Lance ou relance le niveau courant. */
  onStart: () => void
  onNextLevel: () => void
  className?: string
}

const ENTER: Transition = { duration: 0.25, ease: ease.outExpo }
const LEAVE: Transition = { duration: duration.fast, ease: ease.inQuad }

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
  const open = visible && phase !== 'playing'

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

/**
 * Calque animé rendu inerte dès sa sortie : ni clic ni Entrée tardif ne peut
 * réactiver un bouton qui s'efface (double « Niveau suivant », par exemple).
 */
function PresenceLayer(props: ComponentProps<typeof motion.div>) {
  const isPresent = useIsPresent()
  return <motion.div inert={!isPresent} {...props} />
}

interface PanelProps {
  state: GameState
  onStart: () => void
}

/** Carte de dialogue commune : titre, description, contenu et actions. */
function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: ReactNode
  description: ReactNode
  children?: ReactNode
  actions: ReactNode
}) {
  const id = useId()
  return (
    <Card
      role="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className="shadow-lg"
    >
      <CardHeader>
        <CardTitle id={`${id}-title`} className="text-xl">
          {title}
        </CardTitle>
        <CardDescription id={`${id}-description`}>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      <CardFooter data-slot="level-overlay-actions" className="flex-col gap-2">
        {actions}
      </CardFooter>
    </Card>
  )
}

function ReadyPanel({ state, onStart }: PanelProps) {
  const { level } = state
  const seconds = Math.round(level.durationMs / 1000)
  return (
    <Panel
      title={level.title}
      description={`Trouve ${level.targetCount} notes en ${seconds} secondes.`}
      actions={
        <>
          <Button size="lg" className="w-full" autoFocus onClick={onStart}>
            <Play />
            Commencer
          </Button>
          <p className="text-xs text-muted-foreground pointer-coarse:hidden">
            ou appuie sur <Kbd>Entrée</Kbd>
          </p>
        </>
      }
    >
      <div
        data-slot="level-overlay-controls"
        className="flex flex-col gap-3 text-sm text-muted-foreground"
      >
        <p className="pointer-coarse:hidden">Clique sur le piano ou joue au clavier :</p>
        <p className="hidden pointer-coarse:block">Touche le piano pour répondre.</p>
        <dl className="grid grid-cols-7 gap-1 pointer-coarse:hidden">
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
          Maintiens <Kbd>⇧ Maj</Kbd> pour jouer le dièse.
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
  const { level, startedAt, endedAt } = state
  const elapsed = startedAt !== null && endedAt !== null ? endedAt - startedAt : 0
  return (
    <Panel
      title={'Niveau réussi\u00a0!'}
      description={`${level.title} · ${level.targetCount} notes trouvées`}
      actions={
        hasNextLevel ? (
          <>
            <Button size="lg" className="w-full" autoFocus onClick={onNextLevel}>
              Niveau suivant
              <ArrowRight />
            </Button>
            <Button variant="outline" className="w-full" onClick={onStart}>
              <RotateCcw />
              Rejouer
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" className="w-full" autoFocus onClick={onStart}>
              <RotateCcw />
              Rejouer
            </Button>
            <p className="text-xs text-muted-foreground">D’autres niveaux arrivent bientôt.</p>
          </>
        )
      }
    >
      <dl data-slot="level-overlay-stats" className="grid grid-cols-3 divide-x rounded-lg border">
        <Stat label="Temps" value={formatSeconds(elapsed)} />
        <Stat label="Erreurs" value={state.mistakes} />
        <Stat label="Meilleure série" value={state.bestStreak} />
      </dl>
    </Panel>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div data-slot="level-overlay-stat" className="flex flex-col justify-between gap-1 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg leading-tight font-semibold whitespace-nowrap tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function LostPanel({ state, onStart }: PanelProps) {
  const { level, correctCount } = state
  return (
    <Panel
      title="Temps écoulé"
      description={`${correctCount} / ${level.targetCount} notes trouvées`}
      actions={
        <Button size="lg" className="w-full" autoFocus onClick={onStart}>
          <RotateCcw />
          Réessayer
        </Button>
      }
    />
  )
}
