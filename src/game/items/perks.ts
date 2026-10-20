import { ITEM_RULES } from '@/game/config'
import type { Inventory } from '@/game/coins/wallet'
import { NO_PERKS, type Perks } from '@/game/engine/types'
import { hasUpgrade } from './inventory'

/** Bonus que les améliorations permanentes du joueur apportent à une partie classique. */
export function perksFor(inventory: Inventory): Perks {
  if (!hasUpgrade(inventory, 'amp50')) return NO_PERKS
  return { ...NO_PERKS, comboBonusMs: ITEM_RULES.amp50.comboBonusMs }
}
