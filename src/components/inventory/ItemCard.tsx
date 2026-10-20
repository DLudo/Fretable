import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, Flame, ShoppingCart, Speaker, type LucideIcon } from 'lucide-react'

import { Coin } from '@/components/game/coins'
import { formatScore } from '@/components/game/hud'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useWallet } from '@/game/coins'
import {
  buyItem,
  hasUpgrade,
  isArmed,
  ownedCount,
  setArmed,
  type ItemId,
  type ItemInfo,
} from '@/game/items'
import { cn } from '@/lib/utils'

/** Le second appui confirme l'achat ; passé ce délai, il faut recommencer (ms). */
const CONFIRM_MS = 3000
/** Durée du message « Acheté » (ms). */
const DONE_MS = 2000

const ICONS: Record<ItemId, { icon: LucideIcon; tone: string }> = {
  lamps: { icon: Flame, tone: 'bg-combo-fire text-combo-fire-foreground' },
  amp50: { icon: Speaker, tone: 'bg-combo text-combo-foreground' },
}

/**
 * Carte d'un objet de l'inventaire : son effet, son prix, ce que le joueur en
 * possède. Un achat se confirme d'un second appui, pour qu'un toucher
 * malencontreux ne dépense rien. Un consommable en réserve s'active pour la
 * prochaine partie ; une amélioration acquise est simplement installée.
 */
export function ItemCard({ item }: { item: ItemInfo }): ReactNode {
  const id = useId()
  const { balance, inventory } = useWallet()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [confirming])
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), DONE_MS)
    return () => window.clearTimeout(timer)
  }, [done])

  const consumable = item.kind === 'consumable'
  const stock = consumable ? ownedCount(inventory, item.id as 'lamps') : 0
  const installed = !consumable && hasUpgrade(inventory, item.id as 'amp50')
  const armed = consumable && isArmed(inventory, item.id as 'lamps')
  const missing = Math.max(0, item.price - balance)
  const { icon: Icon, tone } = ICONS[item.id]

  const buy = () => {
    if (!confirming) return setConfirming(true)
    setConfirming(false)
    if (buyItem(item.id) === 'bought') setDone(true)
  }

  return (
    <li
      data-slot="item-card"
      data-item={item.id}
      data-armed={armed || undefined}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors',
        armed && 'border-combo-fire',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn('grid size-10 shrink-0 place-items-center rounded-lg', tone)}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`${id}-name`} className="leading-tight font-semibold">
            {item.name}
          </h3>
          <p className="text-sm text-muted-foreground">{item.effect}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          <Coin className="size-4" />
          {formatScore(item.price)}
          <span className="sr-only">pièces</span>
        </span>
        {installed ? (
          <Badge variant="secondary" className="gap-1">
            <Check aria-hidden />
            Installée
          </Badge>
        ) : (
          <Button
            size="sm"
            variant={confirming ? 'default' : 'outline'}
            disabled={missing > 0}
            aria-describedby={`${id}-name`}
            onClick={buy}
          >
            <ShoppingCart aria-hidden />
            {confirming ? 'Confirmer l’achat' : 'Acheter'}
          </Button>
        )}
      </div>

      {consumable && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            En réserve :{' '}
            <strong className="font-semibold text-foreground tabular-nums">{stock}</strong>
          </span>
          <label className="inline-flex items-center gap-2 select-none">
            <Switch
              checked={armed}
              disabled={stock === 0}
              onCheckedChange={(next) => setArmed(item.id as 'lamps', next)}
              className="data-[state=checked]:bg-combo-fire"
            />
            <span className={cn(stock === 0 && 'text-muted-foreground')}>
              Activer pour la prochaine partie
            </span>
          </label>
        </div>
      )}

      <p role="status" className="min-h-0 text-xs text-muted-foreground empty:hidden">
        {done
          ? consumable
            ? 'Acheté : il t’attend dans ta réserve.'
            : 'Achetée : elle agit dès ta prochaine partie.'
          : !installed && missing > 0
            ? `Il te manque ${formatScore(missing)} pièces.`
            : ''}
      </p>
    </li>
  )
}
