import { useCallback, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react'

import { Fretboard } from '@/components/game/fretboard'
import { useAutoSuspend, usePortraitBlocked } from '@/components/game/orientation'
import { PauseOverlay } from '@/components/game/overlays'
import { Piano, type PianoFeedback } from '@/components/game/piano'
import { useBoardFit } from '@/components/game/useBoardFit'
import { useBoardImpact } from '@/components/game/useBoardImpact'
import { RevealLayer } from '@/effects'
import { COMBO_AURA, COMBO_FIRE_AURA, ComboAura } from '@/effects/ambient'
import { gameCoinKey, useCoinReward } from '@/game/coins'
import { BOSS_RULES } from '@/game/config'
import {
  bossComboTier,
  rateBossFight,
  useBossGame,
  windowOf,
  type BossComboTier,
  type BossJudgement,
  type BossNote,
  type BossState,
} from '@/game/boss'
import type { GuessResult } from '@/game/engine/types'
import { createNeckLayout } from '@/game/fretboard/geometry'
import type { BoardProjection } from '@/game/fretboard/projection'
import { useKeyboardControls } from '@/game/input/useKeyboardControls'
import { stringNumber } from '@/game/music/tuning'
import { requestLandscape } from '@/lib/landscape'
import { useTouchDevice } from '@/lib/touch'
import { cn } from '@/lib/utils'
import { BossHud } from './BossHud'
import { BossLayer } from './BossLayer'
import { BossOverlay } from './BossOverlay'

/** L'écran de fin attend que le dernier jugement ait pu être lu (ms). */
const END_SCREEN_DELAY_MS = 900

/**
 * Le palier du combo s'annonce une seconde après son déclenchement : à cet
 * instant précis part une nouvelle note, annoncée elle aussi (ms).
 */
const COMBO_ANNOUNCE_DELAY_MS = 1000

const COMBO_ANNOUNCEMENT: Record<BossComboTier, string> = {
  combo: 'Combo : points doublés',
  fire: 'Combo en feu : points triplés',
}

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

/** Note bonus manquée ou fausse : elle ne coûte rien, et passe sans révélation ni impact. */
const isSilent = (hit: NonNullable<BossState['lastHit']>, notes: readonly BossNote[]) =>
  notes[hit.index]?.bonus === true && !isSuccess(hit.judgement)

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
  const { id, stringIndex, fret, pc, bonus } = notes[hit.index]
  const correct = isSuccess(hit.judgement)
  return {
    id: Math.round(hit.at),
    challenge: { id, stringIndex, fret, pc },
    guess: hit.guess,
    correct,
    streak: correct ? combo : 0,
    at: hit.at,
    reactionMs: REVEAL_REACTION_MS[hit.judgement],
    basePoints: hit.points / hit.multiplier,
    // La pastille « ×2 » ou « ×3 » de la révélation suit le combo, comme en partie classique.
    multiplier: hit.multiplier,
    points: hit.points,
    comboTriggered: correct && !bonus && combo === BOSS_RULES.combo.triggerCount,
    assisted: false,
  }
}

export interface BossScreenProps {
  /** Interrupteur de mode, posé en tête du HUD. */
  modeSwitch?: ReactNode
  className?: string
}

/**
 * Écran du boss final : HUD avec barre de vie, et le manche. Au clavier, il
 * reste seul, pour laisser toute la hauteur aux fantômes qui montent du bas de
 * l'écran ; sur écran tactile, un piano s'y ajoute dessous, et les fantômes,
 * partis du même bas d'écran, jaillissent de son bord. Toute la logique vit
 * dans `useBossGame`.
 */
export function BossScreen({ modeSwitch, className }: BossScreenProps) {
  const boss = useBossGame()
  const { state, start, press, suspend, resume } = boss
  const playing = state.phase === 'playing'
  const layout = useMemo(() => createNeckLayout({ tuning: boss.tuning }), [boss.tuning])
  // Sur écran tactile, sans clavier, on joue au piano.
  const touch = useTouchDevice()
  // Au piano, un cinquième de la scène reste à la piste des fantômes.
  const { mainRef, pianoRef, maxWidth } = useBoardFit(
    layout.viewBox.width / layout.viewBox.height,
    { reserveShare: touch ? 0.2 : 0 },
  )

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

  // Pièces : le combat fini, son score converti et la prime de ses étoiles
  // créditent le portefeuille, une seule fois par combat.
  const ended = state.phase === 'won' || state.phase === 'lost'
  const coins = useCoinReward(
    ended && state.startedAt !== null ? gameCoinKey('boss', state.startedAt) : null,
    {
      score: state.score,
      stars: rateBossFight(state).stars,
    },
  )

  // Combat suspendu (écran en portrait, page quittée) : tout attend la reprise.
  const suspended = state.suspendedAt !== null
  const blocked = usePortraitBlocked()
  useAutoSuspend(playing && !suspended, suspend)

  // Lancer ou reprendre, d'un geste du joueur : sur écran tactile, plein écran
  // et paysage verrouillé quand l'appareil le permet.
  const startFight = () => {
    void requestLandscape()
    start()
  }
  const resumeFight = () => {
    void requestLandscape()
    resume()
  }

  const confirm = () => {
    if (blocked) return
    if (suspended) resumeFight()
    else if (overlayVisible && !playing) startFight()
  }
  const { sharpMode, pressed } = useKeyboardControls({ onNote: press, onConfirm: confirm })

  // Mêmes retours qu'en mode classique : impact du manche et révélation de la note.
  const { ref: boardRef, impact } = useBoardImpact()
  // Un impact par jugement : une reprise, qui décale les notes, n'en rejoue aucun.
  const lastHit = state.lastHit
  const { notes, combo } = state
  const impactOf = useEffectEvent((hit: NonNullable<BossState['lastHit']>) => {
    if (!isSilent(hit, notes)) impact(isSuccess(hit.judgement))
  })
  useEffect(() => {
    if (lastHit) impactOf(lastHit)
  }, [lastHit])
  // Dernier jugement, série et notes changent ensemble : une révélation par jugement.
  // Une note bonus qui passe sans révélation laisse la précédente en place (un
  // résultat nul effacerait toutes les révélations en cours).
  const [revealed, setRevealed] = useState<{
    source: BossState['lastHit']
    result: GuessResult | null
  }>({ source: null, result: null })
  if (lastHit !== revealed.source) {
    setRevealed({
      source: lastHit,
      result:
        lastHit && isSilent(lastHit, notes)
          ? revealed.result
          : revealResultOf({ lastHit, notes, combo }),
    })
  }
  const reveal = revealed.result
  // Le piano s'allume comme en partie classique : touche jouée, juste ou fausse,
  // et la bonne note sur une erreur ou un raté.
  const pianoFeedback = useMemo<PianoFeedback | null>(
    () =>
      reveal && {
        id: reveal.id,
        guess: reveal.guess,
        answer: reveal.challenge.pc,
        correct: reveal.correct,
      },
    [reveal],
  )

  // Combo : l'aura bleue du mode classique, puis enflammée. Elle garde la couleur
  // de son dernier palier le temps de s'éteindre, et passe sous fantômes et révélations.
  const tier = playing ? bossComboTier(combo) : null
  const [auraTier, setAuraTier] = useState<BossComboTier>('combo')
  if (tier && tier !== auraTier) setAuraTier(tier)
  const auraConfig = auraTier === 'fire' ? COMBO_FIRE_AURA : COMBO_AURA

  const [comboAnnouncement, setComboAnnouncement] = useState('')
  // Suspendu, le combat n'annonce rien : le palier se dira après la reprise.
  useEffect(() => {
    if (suspended) return
    const timer = window.setTimeout(
      () => setComboAnnouncement(tier ? COMBO_ANNOUNCEMENT[tier] : ''),
      tier ? COMBO_ANNOUNCE_DELAY_MS : 0,
    )
    return () => window.clearTimeout(timer)
  }, [tier, suspended])

  const overlay = useCallback(
    (projection: BoardProjection) => (
      <>
        <ComboAura
          active={tier !== null}
          config={auraConfig}
          layout={layout}
          projection={projection}
        />
        <BossLayer
          state={state}
          layout={layout}
          projection={projection}
          floorRef={touch ? pianoRef : undefined}
        />
        <RevealLayer result={reveal} layout={layout} projection={projection} />
      </>
    ),
    [tier, auraConfig, state, reveal, layout, touch, pianoRef],
  )

  // Annonce de chaque note à son départ, au moment où elle paraît à l'écran (soit
  // son trajet avant de la jouer), dans l'ordre des départs : une note bonus, plus
  // rapide, part après des notes qu'elle devance à l'arrivée.
  const launchOrder = useMemo(
    () =>
      state.notes
        .map((_, index) => index)
        .sort((a, b) => state.notes[a].launchAt - state.notes[b].launchAt || a - b),
    [state.notes],
  )
  // Chaque annonce retient sa place dans la file à l'instant où elle sonne :
  // combien de notes la séparent de celle à jouer.
  // Une reprise décale la partition sans la remplacer : la file se reconnaît
  // à son combat (`startedAt`), et non aux notes elles-mêmes. La note annoncée
  // est retenue par son index, que l'ordre des départs bouge ou non.
  const [launched, setLaunched] = useState<{
    startedAt: number | null
    step: number
    index: number
    ahead: number
  } | null>(null)
  const announce = useEffectEvent((step: number) => {
    // La note à jouer : la première dont la fenêtre est encore ouverte (un raté
    // échu peut ne pas avoir encore été jugé).
    const now = performance.now()
    let current = state.cursor
    while (
      current < state.notes.length &&
      now > state.notes[current].hitAt + windowOf(state.notes[current]).lateMs
    ) {
      current++
    }
    const index = launchOrder[step]
    setLaunched({ startedAt: state.startedAt, step, index, ahead: index - current })
  })
  const launchedStep = playing && launched?.startedAt === state.startedAt ? launched.step : -1
  // Suspendu, le combat n'annonce rien : la note suivante part plus tard.
  useEffect(() => {
    if (!playing || suspended) return
    const step = launchedStep + 1
    const note = state.notes[launchOrder[step]]
    if (!note) return
    const timer = window.setTimeout(
      () => announce(step),
      Math.max(0, note.launchAt - performance.now()),
    )
    return () => window.clearTimeout(timer)
  }, [playing, suspended, state.notes, launchOrder, launchedStep])
  const announced = launchedStep >= 0 && launched ? state.notes[launched.index] : undefined
  // Une note bonus part après des notes qu'elle devance : l'annonce dit sa place.
  const bonusPlace =
    !launched || launched.ahead <= 1
      ? 'juste après la note à jouer'
      : launched.ahead === 2
        ? 'après la note suivante'
        : `dans ${launched.ahead} notes`

  return (
    <div data-slot="boss-screen" className={cn('flex h-dvh flex-col overflow-hidden', className)}>
      <BossHud state={state} leading={modeSwitch} className="shrink-0" />
      <main
        ref={mainRef}
        data-slot="game-stage"
        data-touch={touch || undefined}
        className={cn(
          'relative flex min-h-0 flex-1 flex-col items-center px-4 pt-2 pb-[clamp(0.75rem,3vh,1.5rem)]',
          // Au piano, le manche monte et le piano descend : entre eux, la piste des fantômes.
          touch ? 'justify-between gap-4 pt-[clamp(1.25rem,6vh,2.5rem)]' : 'justify-center',
        )}
      >
        <div
          ref={boardRef}
          data-slot="game-board"
          data-combo={tier ?? undefined}
          className="relative w-full"
          style={{ maxWidth }}
        >
          <Fretboard layout={layout} marker={null} overlay={overlay} />
        </div>
        {touch && (
          // Hors combat, le piano sort du parcours clavier et de l'arbre d'accessibilité.
          <div
            ref={pianoRef}
            data-slot="game-piano"
            className="w-full"
            inert={!playing || suspended}
          >
            <Piano
              onPress={press}
              pressed={pressed}
              sharpMode={sharpMode}
              feedback={pianoFeedback}
              disabled={!playing || suspended}
              // Plus bas qu'en partie classique : la piste des fantômes y gagne.
              className="[&_[data-slot=piano-keybed]]:[--keybed-h:clamp(4.5rem,min(max(6rem,26cqw),22dvh),9rem)]"
            />
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {announced
            ? `${announced.bonus ? `Note bonus, ${bonusPlace}` : 'Ensuite'} : corde ${stringNumber(boss.tuning, announced.stringIndex)}, case ${announced.fret}`
            : ''}
        </p>
        <p className="sr-only" aria-live="polite">
          {comboAnnouncement}
        </p>
        <BossOverlay
          state={state}
          visible={overlayVisible}
          coins={coins}
          touch={touch}
          onStart={startFight}
        />
        <PauseOverlay open={suspended} onResume={resumeFight} />
      </main>
    </div>
  )
}
