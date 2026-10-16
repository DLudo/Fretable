import { useEffect } from 'react'

import { coinReward } from './reward'
import { creditWallet, receiptFor, useWallet, type CoinReceipt } from './wallet'

/**
 * Crédite le portefeuille à la fin d'une partie et rend le reçu de ce crédit.
 * `key` identifie la partie (voir `gameCoinKey`) : `null` tant qu'elle n'est
 * pas finie. Le crédit est idempotent : doubles rendus, réouvertures de
 * l'écran de fin ou crédits faits dans un autre onglet n'en refont aucun, et
 * le reçu reste celui de cette partie.
 */
export function useCoinReward(
  key: string | null,
  { score, stars }: { score: number; stars: number },
): CoinReceipt | null {
  const wallet = useWallet()
  useEffect(() => {
    if (key !== null) creditWallet(key, coinReward({ score, stars }))
  }, [key, score, stars])
  return key !== null ? receiptFor(wallet, key) : null
}
