import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { motion, useAnimate, useReducedMotion, type Transition } from 'motion/react'

import { Kbd } from '@/components/ui/kbd'
import { GAME_FEEL } from '@/game/config'
import type { PitchClass } from '@/game/music/notes'
import { cn } from '@/lib/utils'
import { duration, ease } from '@/theme/motion'
import type { PianoKeyColor } from './layout'

/** Rôle d'une touche dans le dernier retour : touche jouée (juste / fausse) ou bonne réponse. */
export type PianoKeyFeedback = 'correct' | 'wrong' | 'answer'

export interface PianoKeyProps {
  pc: PitchClass
  color: PianoKeyColor
  /** Nom affiché (« Do♯ »). */
  name: string
  /** Nom accessible (« Do dièse »). */
  label: string
  /** Raccourci clavier affiché (« ⇧Q »), ou `null`. */
  hint: string | null
  shortcut?: string
  /** Enfoncée au clavier d'ordinateur. */
  pressed: boolean
  /** Maj maintenue : mode dièse. */
  sharpMode: boolean
  /** Raccourci estompé (Mi et Si en mode dièse : pas de touche noire). */
  hintMuted: boolean
  disabled: boolean
  /** Identifiant du retour qui concerne cette touche ; chaque nouvel id rejoue le flash. */
  feedbackId: number | null
  feedbackKind: PianoKeyFeedback | null
  /** Chaque nouvel id fait trembler la touche. */
  nudgeId: number | null
  onPress: (pc: PitchClass) => void
  style?: CSSProperties
  className?: string
}

interface Flash {
  id: number
  kind: PianoKeyFeedback
}

/** Flash de la touche jouée : allumage franc, retour en ease-out. */
const HIT_TRANSITION: Transition = {
  duration: duration.slow,
  times: [0, 0.1, 1],
  ease: ['linear', [...ease.outQuart]],
}

/** Pulsation de la bonne réponse : dure le temps du blocage après une erreur. */
const ANSWER_TRANSITION: Transition = {
  duration: GAME_FEEL.holdAfterWrongMs / 1000,
  times: [0, 0.1, 0.36, 0.58, 1],
  // Une courbe par segment (une courbe unique s'appliquerait à toute la timeline).
  ease: [[...ease.outQuart], 'easeInOut', 'easeInOut', [...ease.outQuart]],
}

const FLASH_KEYFRAMES: Record<PianoKeyFeedback, number[]> = {
  correct: [1, 1, 0],
  wrong: [1, 1, 0],
  answer: [0, 1, 0.4, 1, 0],
}

const FLASH_CLASS: Record<PianoKeyFeedback, string> = {
  correct: 'bg-feedback-success shadow-[0_0_22px_2px_var(--feedback-success)]',
  wrong: 'bg-feedback-error',
  answer:
    'bg-feedback-success/20 shadow-[0_0_18px_var(--feedback-success)] inset-ring-[3px] inset-ring-feedback-success',
}

const NUDGE_KEYFRAMES = [0, -3, 3, -2, 2, -1, 0]

/** Fenêtre pendant laquelle un `click` est attribué au `pointerdown` qui le précède. */
const CLICK_AFTER_POINTER_MS = 1000

/**
 * Une touche de piano. Le bouton occupe toute la case (zone de clic sans
 * interstice) ; la surface visible, légèrement en retrait, porte les états.
 */
export function PianoKey({
  pc,
  color,
  name,
  label,
  hint,
  shortcut,
  pressed,
  sharpMode,
  hintMuted,
  disabled,
  feedbackId,
  feedbackKind,
  nudgeId,
  onPress,
  style,
  className,
}: PianoKeyProps): ReactNode {
  const white = color === 'white'
  const reduceMotion = useReducedMotion()

  // — Appui pointeur (souris, doigts multiples, stylet) —
  const pointers = useRef(new Set<number>())
  const lastPointerDownAt = useRef(Number.NEGATIVE_INFINITY)
  const [held, setHeld] = useState(false)
  const down = pressed || held

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    // Pas de focus sur la touche : Entrée / Espace restent des raccourcis globaux.
    event.preventDefault()
    lastPointerDownAt.current = event.timeStamp
    if (disabled) return
    pointers.current.add(event.pointerId)
    setHeld(true)
    onPress(pc)
  }

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    setHeld(pointers.current.size > 0)
  }

  // Activation au clavier (touche focalisée + Entrée / Espace). Les clics issus
  // d'un pointeur ont déjà été transmis au `pointerdown` : on les écarte. Un tap
  // tactile produit un clic avec `detail === 0`, d'où les deux garde-fous suivants.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const { pointerType } = event.nativeEvent as globalThis.MouseEvent & { pointerType?: string }
    const fromPointer =
      event.detail !== 0 || !!pointerType || event.timeStamp - lastPointerDownAt.current < CLICK_AFTER_POINTER_MS
    if (fromPointer || disabled) return
    onPress(pc)
  }

  // — Flash de retour : chaque nouvel id le rejoue, même sur la même touche —
  const [flash, setFlash] = useState<Flash | null>(null)
  const [seenFeedbackId, setSeenFeedbackId] = useState<number | null>(null)
  if (feedbackId !== null && feedbackKind !== null && feedbackId !== seenFeedbackId) {
    setSeenFeedbackId(feedbackId)
    setFlash({ id: feedbackId, kind: feedbackKind })
  }

  // — Refus (Maj + Mi / Maj + Si) : tremblement amorti —
  const [surface, animate] = useAnimate<HTMLSpanElement>()
  useEffect(() => {
    if (nudgeId === null || reduceMotion || !surface.current) return
    animate(surface.current, { x: NUDGE_KEYFRAMES }, { duration: 0.25, ease: 'easeOut' })
  }, [nudgeId, reduceMotion, animate, surface])

  return (
    <button
      type="button"
      data-slot="piano-key"
      data-color={color}
      data-state={down ? 'pressed' : 'idle'}
      data-feedback={flash?.kind}
      data-pc={pc}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleClick}
      style={style}
      className={cn(
        'group touch-manipulation outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]',
        white ? 'relative h-full' : 'absolute top-0 z-10',
        flash && (white ? 'z-[1]' : 'z-20'),
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <span
        ref={surface}
        data-slot="piano-key-surface"
        className={cn(
          'absolute transition-[background-color,box-shadow,translate] ease-out',
          down ? 'duration-[40ms]' : 'duration-150',
          white
            ? [
                'inset-x-px inset-y-0 rounded-b-[clamp(4px,1.3cqw,8px)] group-focus-visible:inset-ring-[3px] group-focus-visible:inset-ring-key-white-foreground/45',
                down
                  ? 'translate-y-[2px] bg-key-white-pressed shadow-[inset_0_-2px_0_color-mix(in_oklab,var(--key-border)_14%,transparent),inset_0_10px_8px_-8px_color-mix(in_oklab,var(--key-border)_60%,transparent)]'
                  : 'bg-key-white shadow-[inset_0_-6px_0_color-mix(in_oklab,var(--key-border)_13%,transparent),inset_0_10px_8px_-8px_color-mix(in_oklab,var(--key-border)_45%,transparent),0_2px_0_color-mix(in_oklab,var(--key-border)_80%,transparent)]',
                !down && !disabled && 'group-hover:bg-[color-mix(in_oklab,var(--key-white)_70%,var(--key-white-pressed))]',
              ]
            : [
                'inset-0 rounded-b-[clamp(3px,0.9cqw,5px)] group-focus-visible:inset-ring-[3px] group-focus-visible:inset-ring-key-black-foreground/80',
                // Reflet sur le dessus de la touche.
                'before:absolute before:inset-x-[14%] before:top-0 before:h-[58%] before:rounded-b-[3px] before:bg-linear-to-b before:from-key-black-foreground/14 before:to-transparent before:transition-opacity',
                down
                  ? 'translate-y-[1.5px] bg-key-black-pressed shadow-[inset_0_-3px_0_color-mix(in_oklab,var(--key-black-foreground)_8%,transparent),0_1px_2px_color-mix(in_oklab,var(--key-border)_70%,transparent)] before:opacity-50'
                  : 'shadow-[inset_1px_0_0_color-mix(in_oklab,var(--key-black-foreground)_9%,transparent),inset_-1px_0_0_color-mix(in_oklab,var(--key-black-foreground)_9%,transparent),inset_0_-7px_0_color-mix(in_oklab,var(--key-black-foreground)_10%,transparent),0_4px_5px_color-mix(in_oklab,var(--key-border)_75%,transparent)]',
                !down &&
                  (sharpMode
                    ? 'bg-[color-mix(in_oklab,var(--key-black)_68%,var(--key-black-foreground))] inset-ring-2 inset-ring-key-black-foreground/60 before:from-key-black-foreground/25'
                    : 'bg-key-black'),
                !down &&
                  !disabled &&
                  !sharpMode &&
                  'group-hover:bg-[color-mix(in_oklab,var(--key-black)_75%,var(--key-black-pressed))]',
              ],
        )}
      >
        {flash && (
          <motion.span
            key={flash.id}
            aria-hidden
            data-slot="piano-key-flash"
            className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', FLASH_CLASS[flash.kind])}
            initial={{ opacity: FLASH_KEYFRAMES[flash.kind][0] }}
            animate={{ opacity: FLASH_KEYFRAMES[flash.kind] }}
            transition={flash.kind === 'answer' ? ANSWER_TRANSITION : HIT_TRANSITION}
            onAnimationComplete={() => setFlash((current) => (current?.id === flash.id ? null : current))}
          />
        )}

        <span
          data-slot="piano-key-label"
          className={cn(
            'pointer-events-none absolute inset-x-0 flex flex-col items-center leading-none',
            white
              ? 'bottom-[clamp(12px,3.4cqw,18px)] gap-[clamp(4px,1.1cqw,7px)]'
              : 'bottom-[clamp(6px,1.9cqw,11px)] gap-[clamp(3px,0.8cqw,5px)]',
          )}
        >
          <span
            data-slot="piano-key-name"
            className={cn(
              'font-semibold tracking-tight whitespace-nowrap',
              white
                ? 'text-[length:clamp(0.75rem,3.2cqw,1rem)] text-key-white-foreground'
                : 'text-[length:clamp(10px,2.55cqw,12.5px)] text-key-black-foreground',
            )}
          >
            {name}
          </span>
          {hint && (
            <Kbd
              data-slot="piano-key-hint"
              className={cn(
                'font-mono leading-none transition-[opacity,background-color,color] duration-[120ms]',
                white
                  ? 'h-[clamp(16px,4.2cqw,21px)] min-w-[clamp(16px,4.2cqw,21px)] px-[clamp(3px,1cqw,5px)] text-[length:clamp(10px,2.6cqw,12px)]'
                  : 'h-[clamp(14px,3.5cqw,18px)] min-w-0 px-[clamp(2px,0.6cqw,4px)] text-[length:clamp(9px,2.2cqw,11px)]',
                white
                  ? 'bg-key-white-foreground/8 text-key-white-foreground/65 shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--key-white-foreground)_18%,transparent)]'
                  : sharpMode
                    ? 'bg-key-black-foreground text-key-black'
                    : 'bg-key-black-foreground/12 text-key-black-foreground/75',
                hintMuted && 'opacity-25',
              )}
            >
              {hint}
            </Kbd>
          )}
        </span>
      </span>
    </button>
  )
}
