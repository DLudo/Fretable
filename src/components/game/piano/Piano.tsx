import { useCallback, type PointerEvent, type ReactNode } from 'react'

import { NOTATION } from '@/game/config'
import { keyHint } from '@/game/input/keymap'
import { noteName, sharpOf, type Notation, type PitchClass } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { ariaShortcut, PIANO_KEYS, spokenNoteName, type PianoKeySlot } from './layout'
import { PianoKey, type PianoKeyFeedback } from './PianoKey'

/** Retour d'une réponse, affiché sur les touches. */
export interface PianoFeedback {
  id: number
  /** Touche jouée ; `null` quand le temps est écoulé (seule la bonne réponse s'allume). */
  guess: PitchClass | null
  answer: PitchClass
  correct: boolean
}

export interface PianoProps {
  /** Appui sur une touche (pointeur, ou touche focalisée + Entrée / Espace). */
  onPress: (pc: PitchClass) => void
  /** Notes maintenues au clavier d'ordinateur (état enfoncé). */
  pressed?: ReadonlySet<PitchClass>
  /** Maj maintenue : mode dièse. */
  sharpMode?: boolean
  /** Dernière réponse : chaque nouvel id rejoue le flash ; `null` l'efface (nouvelle partie). */
  feedback?: PianoFeedback | null
  /** Maj + Mi / Maj + Si (pas de touche noire) : chaque nouvel id fait trembler la touche naturelle. */
  nudge?: { id: number; pc: PitchClass } | null
  /** Aucune partie en cours : appuis ignorés, touches retirées du parcours Tab. */
  disabled?: boolean
  notation?: Notation
  /** Raccourcis clavier sur les touches (masqués sans pointeur fin, donc en tactile seul). */
  showKeyHints?: boolean
  className?: string
}

const NO_KEYS: ReadonlySet<PitchClass> = new Set()

function feedbackFor(pc: PitchClass, feedback: PianoFeedback | null): PianoKeyFeedback | null {
  if (!feedback) return null
  if (feedback.guess !== null && pc === feedback.guess)
    return feedback.correct ? 'correct' : 'wrong'
  if (!feedback.correct && pc === feedback.answer) return 'answer'
  return null
}

/**
 * Petit piano d'une octave (Do → Si) servant de pavé de réponse.
 *
 * Largeur : au plus ≈ 500 px, la marge latérale venant du parent ; en paysage,
 * le piano prend jusqu'à ≈ 2/3 de l'écran pour garder des touches larges.
 * Hauteur (`--keybed-h`) : suit la largeur (requêtes de conteneur), mais ne
 * dépasse pas 30 % de la hauteur d'écran, ce qui laisse la place au manche sur
 * mobile en paysage. Les étiquettes des touches blanches suivent cette hauteur
 * pour rester sous les touches noires.
 * Les appuis sont transmis dès le `pointerdown` pour une latence nulle.
 */
export function Piano({
  onPress,
  pressed = NO_KEYS,
  sharpMode = false,
  feedback = null,
  nudge = null,
  disabled = false,
  notation = NOTATION,
  showKeyHints = true,
  className,
}: PianoProps): ReactNode {
  const handlePress = useCallback(
    (pc: PitchClass) => {
      if (!disabled) onPress(pc)
    },
    [disabled, onPress],
  )

  // Une touche focalisée au clavier (Tab) ne doit pas garder le focus après un appui pointeur.
  const releaseFocus = (event: PointerEvent<HTMLDivElement>) => {
    const active = document.activeElement
    if (active instanceof HTMLElement && event.currentTarget.contains(active)) active.blur()
  }

  const renderKey = ({ pc, color, box }: PianoKeySlot) => {
    const hint = showKeyHints ? keyHint(pc) : null
    return (
      <PianoKey
        key={pc}
        pc={pc}
        color={color}
        name={noteName(pc, notation)}
        label={spokenNoteName(pc, notation)}
        hint={hint}
        shortcut={ariaShortcut(keyHint(pc))}
        pressed={pressed.has(pc)}
        sharpMode={sharpMode}
        hintMuted={sharpMode && color === 'white' && sharpOf(pc) === null}
        disabled={disabled}
        feedbackId={feedback?.id ?? null}
        feedbackKind={feedbackFor(pc, feedback)}
        nudgeId={nudge?.pc === pc ? nudge.id : null}
        onPress={handlePress}
        style={box}
      />
    )
  }

  return (
    <div
      data-slot="piano"
      data-sharp-mode={sharpMode ? 'on' : 'off'}
      data-disabled={disabled || undefined}
      role="group"
      aria-label="Clavier de piano"
      aria-disabled={disabled || undefined}
      onPointerDownCapture={releaseFocus}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        '@container mx-auto w-full max-w-[min(31rem,max(86dvh,66vw))] touch-manipulation select-none [-webkit-touch-callout:none]',
        className,
      )}
    >
      <div
        data-slot="piano-case"
        className="rounded-[clamp(8px,2.4cqw,14px)] bg-piano-case px-[clamp(4px,1.2cqw,7px)] pt-[clamp(9px,2.6cqw,14px)] pb-[clamp(4px,1.2cqw,7px)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--key-black-foreground)_14%,transparent),0_18px_36px_-18px_color-mix(in_oklab,var(--key-border)_95%,transparent)]"
      >
        <div
          data-slot="piano-keybed"
          className="relative grid h-(--keybed-h) grid-cols-7 rounded-b-[clamp(4px,1.3cqw,8px)] border-t-[3px] border-piano-keybed bg-piano-keybed [--keybed-h:clamp(6.5rem,min(max(8.5rem,35cqw),30dvh),11rem)]"
        >
          {PIANO_KEYS.map(renderKey)}
        </div>
      </div>
    </div>
  )
}
