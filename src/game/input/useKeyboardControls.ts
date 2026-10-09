import { useEffect, useRef, useState } from 'react'

import type { PitchClass } from '@/game/music/notes'
import { resolveKey, type KeyResolution } from './keymap'

export interface KeyboardControlsOptions {
  /** Note jouée au clavier. */
  onNote?: (pc: PitchClass) => void
  /** Maj + Mi / Maj + Si : aucune touche noire. */
  onNoSharp?: (natural: PitchClass) => void
  /** Entrée ou Espace (démarrer, rejouer…). */
  onConfirm?: () => void
}

export interface KeyboardControlsState {
  /** Maj maintenue : mode dièse. */
  sharpMode: boolean
  /** Notes actuellement enfoncées au clavier (retour visuel sur le piano). */
  pressed: ReadonlySet<PitchClass>
}

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

/**
 * Contrôles clavier : q s d j k l m → Do Ré Mi Fa Sol La Si, Maj pour le dièse.
 */
export function useKeyboardControls(options: KeyboardControlsOptions): KeyboardControlsState {
  const handlers = useRef(options)
  useEffect(() => {
    handlers.current = options
  })

  const [sharpMode, setSharpMode] = useState(false)
  const [pressed, setPressed] = useState<ReadonlySet<PitchClass>>(() => new Set())
  // Touche physique → note déclenchée, pour relâcher la bonne note même si Maj a changé entre-temps.
  const held = useRef(new Map<string, PitchClass>())

  useEffect(() => {
    const syncPressed = () => setPressed(new Set(held.current.values()))

    const onKeyDown = (event: KeyboardEvent) => {
      setSharpMode(event.shiftKey)
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Enter' || event.key === ' ') {
        // Un bouton focalisé gère déjà Entrée/Espace nativement : pas de double déclenchement.
        if (isInteractive(event.target)) return
        event.preventDefault()
        if (!event.repeat) handlers.current.onConfirm?.()
        return
      }
      const resolution: KeyResolution | null = resolveKey(event.key, event.shiftKey)
      if (!resolution) return
      event.preventDefault()
      if (event.repeat) return
      if (resolution.kind === 'no-sharp') {
        handlers.current.onNoSharp?.(resolution.natural)
        return
      }
      held.current.set(event.code || event.key.toLowerCase(), resolution.pc)
      syncPressed()
      handlers.current.onNote?.(resolution.pc)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      setSharpMode(event.shiftKey)
      if (held.current.delete(event.code || event.key.toLowerCase())) syncPressed()
    }

    const reset = () => {
      setSharpMode(false)
      held.current.clear()
      syncPressed()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', reset)
    }
  }, [])

  return { sharpMode, pressed }
}
