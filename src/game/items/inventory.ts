import { updateWallet, type Inventory, type Wallet } from '@/game/coins/wallet'
import { itemInfo, type ConsumableId, type ItemId, type UpgradeId } from './catalog'

/** Issue d'un achat. */
export type PurchaseOutcome = 'bought' | 'insufficient' | 'owned'

/** Consommables de cet objet en réserve. */
export function ownedCount(inventory: Inventory, id: ConsumableId): number {
  return inventory.consumables[id] ?? 0
}

export function hasUpgrade(inventory: Inventory, id: UpgradeId): boolean {
  return inventory.upgrades.includes(id)
}

export function isArmed(inventory: Inventory, id: ConsumableId): boolean {
  return inventory.armed.includes(id) && ownedCount(inventory, id) > 0
}

function withInventory(state: Wallet, inventory: Partial<Inventory>): Wallet {
  return { ...state, inventory: { ...state.inventory, ...inventory } }
}

/**
 * Achète un objet : son prix est débité et l'objet rangé d'un même geste. Un
 * consommable s'ajoute à la réserve ; une amélioration ne s'achète qu'une fois.
 */
export function buyItem(id: ItemId): PurchaseOutcome {
  const item = itemInfo(id)
  let outcome: PurchaseOutcome = 'bought'
  updateWallet((state) => {
    const { inventory } = state
    if (item.kind === 'upgrade' && hasUpgrade(inventory, id as UpgradeId)) {
      outcome = 'owned'
      return null
    }
    if (state.balance < item.price) {
      outcome = 'insufficient'
      return null
    }
    const paid = { ...state, balance: state.balance - item.price }
    if (item.kind === 'upgrade') {
      return withInventory(paid, { upgrades: [...inventory.upgrades, id as UpgradeId] })
    }
    const consumable = id as ConsumableId
    return withInventory(paid, {
      consumables: {
        ...inventory.consumables,
        [consumable]: ownedCount(inventory, consumable) + 1,
      },
    })
  })
  return outcome
}

/** Active (ou non) un consommable pour la prochaine partie ; sans réserve, rien ne change. */
export function setArmed(id: ConsumableId, armed: boolean): void {
  updateWallet((state) => {
    const { inventory } = state
    if (armed === isArmed(inventory, id)) return null
    if (armed && ownedCount(inventory, id) === 0) return null
    const others = inventory.armed.filter((other) => other !== id)
    return withInventory(state, { armed: armed ? [...others, id] : others })
  })
}

/**
 * Au départ d'une partie : consomme un exemplaire de chaque consommable activé
 * parmi `usable`, et le désactive (une activation vaut pour une partie). Rend
 * ceux qui ont servi.
 */
export function consumeArmed(usable: readonly ConsumableId[]): ConsumableId[] {
  const used: ConsumableId[] = []
  updateWallet((state) => {
    const { inventory } = state
    const spent = inventory.armed.filter((id) => usable.includes(id) && isArmed(inventory, id))
    if (spent.length === 0) return null
    used.push(...spent)
    const consumables = { ...inventory.consumables }
    for (const id of spent) consumables[id] = ownedCount(inventory, id) - 1
    return withInventory(state, {
      consumables,
      armed: inventory.armed.filter((id) => !spent.includes(id)),
    })
  })
  return used
}
