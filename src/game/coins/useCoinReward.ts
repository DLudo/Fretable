import { useEffect } from 'react'

import { coinReward } from './reward'
import { creditWallet, useWallet, type CoinReceipt } from './wallet'

/**
 * Crédite le portefeuille à la fin d'une partie et rend le reçu de ce crédit.
 * `key` identifie la partie (mode, niveau, instant du départ) : `null` tant
 * qu'elle n'est pas finie. Le crédit est idempotent : doubles rendus et
 * réouvertures de l'écran de fin ne recréditent rien.
 */
export function useCoinReward(
  key: string | null,
  { score, stars }: { score: number; stars: number },
): CoinReceipt | null {
  const wallet = useWallet()
  useEffect(() => {
    if (key !== null) creditWallet(key, coinReward({ score, stars }))
  }, [key, score, stars])
  return key !== null && wallet.last?.key === key ? wallet.last : null
}
