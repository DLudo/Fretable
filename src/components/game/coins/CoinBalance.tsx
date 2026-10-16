import type { ReactNode } from 'react'

import { formatScore } from '@/components/game/hud'
import { useWallet } from '@/game/coins'
import { cn } from '@/lib/utils'
import { Coin } from './Coin'

/** Solde du portefeuille, rappelé sur les écrans d'avant partie. */
export function CoinBalance({ className }: { className?: string }): ReactNode {
  const { balance } = useWallet()
  return (
    <p
      data-slot="coin-balance"
      className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)}
    >
      <Coin className="size-4" />
      <span>
        Tes pièces :{' '}
        <strong className="font-semibold text-foreground tabular-nums">
          {formatScore(balance)}
        </strong>
      </span>
    </p>
  )
}
