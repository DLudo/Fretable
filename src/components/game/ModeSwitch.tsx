import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Skull } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface ModeSwitchProps {
  /** Mode boss final activé. */
  checked: boolean
  /** `keyboard` : bascule faite au clavier (Espace, Entrée), et non au pointeur. */
  onCheckedChange: (checked: boolean, source: { keyboard: boolean }) => void
  /**
   * Prendre le focus au montage. Basculer remonte l'écran, donc l'interrupteur :
   * après une bascule au clavier, le nouveau le reprend, et Espace rebascule.
   */
  autoFocus?: boolean
  className?: string
}

/**
 * Interrupteur du mode boss final, en tête du HUD. Basculer relance l'écran
 * dans l'autre mode (la partie en cours est abandonnée). Sur téléphone, seule
 * la tête de mort accompagne l'interrupteur ; son nom reste lu.
 */
export function ModeSwitch({
  checked,
  onCheckedChange,
  autoFocus = false,
  className,
}: ModeSwitchProps): ReactNode {
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  // Un clic au clavier (Espace, Entrée sur le bouton) porte `detail === 0`.
  const keyboard = useRef(false)

  // Après l'autofocus de l'écran qui s'ouvre (bouton « Commencer »), pour le reprendre.
  useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => ref.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])

  return (
    <span
      data-slot="mode-switch"
      data-boss={checked || undefined}
      className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-medium', className)}
    >
      <Switch
        ref={ref}
        id={id}
        checked={checked}
        onClick={(event) => {
          keyboard.current = event.detail === 0
        }}
        onCheckedChange={(next) => onCheckedChange(next, { keyboard: keyboard.current })}
        className="data-[state=checked]:bg-feedback-error"
      />
      <label
        htmlFor={id}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 select-none',
          checked ? 'text-feedback-error' : 'text-muted-foreground',
        )}
      >
        <Skull aria-hidden className="size-3.5" />
        <span className="max-sm:sr-only">Boss</span>
      </label>
    </span>
  )
}
