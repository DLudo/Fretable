import { useId, type MouseEvent, type ReactNode } from 'react'
import { Skull } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface ModeSwitchProps {
  /** Mode boss final activé. */
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

/**
 * Interrupteur du mode boss final, en tête du HUD. Basculer relance l'écran
 * dans l'autre mode (la partie en cours est abandonnée).
 */
export function ModeSwitch({ checked, onCheckedChange, className }: ModeSwitchProps): ReactNode {
  const id = useId()
  // Après un clic, le focus quitte l'interrupteur : Entrée et Espace reviennent
  // au jeu (démarrer) au lieu de le rebasculer. Au clavier, il reste focalisé.
  const releaseFocus = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail > 0) event.currentTarget.blur()
  }
  return (
    <span
      data-slot="mode-switch"
      data-boss={checked || undefined}
      className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-medium', className)}
    >
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        onClick={releaseFocus}
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
        Boss
      </label>
    </span>
  )
}
