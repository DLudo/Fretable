import { COMBO_RULES, ITEM_RULES } from '@/game/config'

/** Consommables : à usage unique, activés pour une partie. */
export type ConsumableId = 'lamps'
/** Améliorations permanentes : achetées une fois, elles restent. */
export type UpgradeId = 'amp50'
export type ItemId = ConsumableId | UpgradeId

export interface ItemInfo<Id extends ItemId = ItemId> {
  id: Id
  kind: Id extends ConsumableId ? 'consumable' : 'upgrade'
  name: string
  /** Effet, en une phrase. */
  effect: string
  /** Prix en pièces. */
  price: number
}

const seconds = (ms: number) => `${Math.round(ms / 100) / 10}`.replace('.', ',')

export const CONSUMABLES: readonly ItemInfo<ConsumableId>[] = [
  {
    id: 'lamps',
    kind: 'consumable',
    name: 'Lampes en surchauffe',
    effect: `Double le score d'une partie classique, et les pièces qu'il rapporte.`,
    price: ITEM_RULES.lamps.price,
  },
]

export const UPGRADES: readonly ItemInfo<UpgradeId>[] = [
  {
    id: 'amp50',
    kind: 'upgrade',
    name: 'Tête d’ampli 50 watts',
    effect: `En partie classique, la jauge du combo tient ${seconds(COMBO_RULES.durationMs + ITEM_RULES.amp50.comboBonusMs)} s au lieu de ${seconds(COMBO_RULES.durationMs)}.`,
    price: ITEM_RULES.amp50.price,
  },
]

const BY_ID = new Map<ItemId, ItemInfo>(
  [...CONSUMABLES, ...UPGRADES].map((item) => [item.id, item]),
)

export function itemInfo<Id extends ItemId>(id: Id): ItemInfo<Id> {
  return BY_ID.get(id) as ItemInfo<Id>
}

export const isConsumableId = (value: unknown): value is ConsumableId =>
  CONSUMABLES.some((item) => item.id === value)

export const isUpgradeId = (value: unknown): value is UpgradeId =>
  UPGRADES.some((item) => item.id === value)
