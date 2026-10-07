import { useCallback, type PointerEvent, type ReactNode } from 'react'

import { NOTATION } from '@/game/config'
import { keyHint } from '@/game/input/keymap'
import { noteName, sharpOf, type Notation, type PitchClass } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { ariaShortcut, PIANO_KEYS, spokenNoteName, type PianoKeySlot } from './layout'
import { PianoKey, type PianoKeyFeedback } from './PianoKey'

export interface PianoFeedback {
  id: number
  guess: PitchClass
  answer: PitchClass
  correct: boolean
}

export interface PianoProps {
  onPress: (pc: PitchClass) => void
  /** Notes currently held on the computer keyboard (visual pressed state). */
  pressed?: ReadonlySet<PitchClass>
  /** Shift held → sharp mode. */
  sharpMode?: boolean
  /** Latest guess; each new id triggers a flash. */
  feedback?: PianoFeedback | null
  /** Shift+Mi / Shift+Si (no black key): each new id shakes that natural key. */
  nudge?: { id: number; pc: PitchClass } | null
  /** No game in progress: presses are not forwarded. */
  disabled?: boolean
  notation?: Notation
  showKeyHints?: boolean
  className?: string
}

const NO_KEYS: ReadonlySet<PitchClass> = new Set()

function feedbackFor(pc: PitchClass, feedback: PianoFeedback | null): PianoKeyFeedback | null {
  if (!feedback) return null
  if (pc === feedback.guess) return feedback.correct ? 'correct' : 'wrong'
  if (!feedback.correct && pc === feedback.answer) return 'answer'
  return null
}

/**
 * Petit piano d'une octave (Do → Si) servant de pavé de réponse.
 *
 * Les tailles découlent de la largeur disponible (requêtes de conteneur) :
 * le parent fournit les marges latérales, le piano occupe au plus ≈ 500 px,
 * et moins sur les écrans bas (mobile en paysage) pour garder ses proportions.
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
    const kind = feedbackFor(pc, feedback)
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
        feedbackId={kind && feedback ? feedback.id : null}
        feedbackKind={kind}
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
        '@container mx-auto w-full max-w-[min(31rem,86dvh)] touch-manipulation select-none [-webkit-touch-callout:none]',
        className,
      )}
    >
      <div
        data-slot="piano-case"
        className="rounded-[clamp(8px,2.4cqw,14px)] bg-key-black px-[clamp(4px,1.2cqw,7px)] pt-[clamp(9px,2.6cqw,14px)] pb-[clamp(4px,1.2cqw,7px)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--key-black-foreground)_14%,transparent),0_18px_36px_-18px_color-mix(in_oklab,var(--key-border)_95%,transparent)]"
      >
        <div
          data-slot="piano-keybed"
          className="relative grid h-[clamp(8.5rem,35cqw,11rem)] grid-cols-7 rounded-b-[clamp(4px,1.3cqw,8px)] border-t-[3px] border-key-border bg-key-border"
        >
          {PIANO_KEYS.map(renderKey)}
        </div>
      </div>
    </div>
  )
}
