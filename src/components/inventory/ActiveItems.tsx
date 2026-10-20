import type { ReactNode } from 'react'
import { Flame, Speaker } from 'lucide-react'

import { useWallet } from '@/game/coins'
import { COMBO_RULES, ITEM_RULES } from '@/game/config'
import { hasUpgrade, isArmed } from '@/game/items'
import { cn } from '@/lib/utils'

const seconds = (ms: number) => `${Math.round(ms / 100) / 10}`.replace('.', ',')

/**
 * Objets qui agiront sur la prochaine partie classique, rappelés avant son
 * départ : consommables activés, améliorations acquises. Rien sans objet.
 */
export function ActiveItems({ className }: { className?: string }): ReactNode {
  const { inventory } = useWallet()
  const lamps = isArmed(inventory, 'lamps')
  const amp = hasUpgrade(inventory, 'amp50')
  if (!lamps && !amp) return null
  return (
    <ul
      data-slot="active-items"
      aria-label="Objets actifs pour cette partie"
      className={cn('flex flex-wrap gap-1.5 text-xs', className)}
    >
      {lamps && (
        <li className="inline-flex items-center gap-1 rounded-full bg-combo-fire px-2 py-0.5 font-medium text-combo-fire-foreground">
          <Flame aria-hidden className="size-3.5" />
          Lampes en surchauffe : score ×{ITEM_RULES.lamps.scoreMultiplier}
        </li>
      )}
      {amp && (
        <li className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-foreground">
          <Speaker aria-hidden className="size-3.5" />
          Ampli 50 W : combo de {seconds(COMBO_RULES.durationMs + ITEM_RULES.amp50.comboBonusMs)} s
        </li>
      )}
    </ul>
  )
}
