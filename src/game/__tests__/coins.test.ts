import { beforeEach, describe, expect, it, vi } from 'vitest'

import { COIN_RULES } from '@/game/config'
import {
  coinReward,
  coinsForScore,
  completionCoins,
  creditWallet,
  readWallet,
  resetWallet,
} from '@/game/coins'

describe('conversion en pièces', () => {
  it('convertit 1 000 points en 100 pièces, arrondi à la pièce inférieure', () => {
    expect(coinsForScore(1000)).toBe(100)
    expect(coinsForScore(12_345)).toBe(1234)
    expect(coinsForScore(9)).toBe(0)
    expect(coinsForScore(0)).toBe(0)
    expect(coinsForScore(-50)).toBe(0)
  })

  it('prime la victoire selon les étoiles : 100, 300, 700', () => {
    expect([0, 1, 2, 3].map((stars) => completionCoins(stars))).toEqual([0, 100, 300, 700])
    expect(completionCoins(5)).toBe(700)
    expect(completionCoins(-1)).toBe(0)
    expect(COIN_RULES.starBonus).toEqual([0, 100, 300, 700])
  })

  it('additionne score converti et prime', () => {
    expect(coinReward({ score: 18_400, stars: 3 })).toEqual({
      fromScore: 1840,
      completion: 700,
      stars: 3,
      total: 2540,
    })
    // Défaite : zéro étoile, seul le score compte.
    expect(coinReward({ score: 5000, stars: 0 })).toEqual({
      fromScore: 500,
      completion: 0,
      stars: 0,
      total: 500,
    })
  })
})

describe('portefeuille', () => {
  // Les tests tournent sans navigateur : un stockage en mémoire en tient lieu.
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  beforeEach(() => {
    store.clear()
    resetWallet()
  })

  it('crédite une partie une seule fois, et rend le même reçu', () => {
    const reward = coinReward({ score: 10_000, stars: 2 })
    const first = creditWallet('classic:0:1234', reward)
    expect(first).toMatchObject({ before: 0, after: 1300 })
    // Double rendu, écran de fin rouvert : rien de plus.
    expect(creditWallet('classic:0:1234', reward)).toBe(first)
    expect(readWallet().balance).toBe(1300)
    // Partie suivante : le solde s'ajoute.
    const next = creditWallet('classic:0:9999', coinReward({ score: 2000, stars: 0 }))
    expect(next).toMatchObject({ before: 1300, after: 1500 })
  })

  it('garde le solde dans le stockage du navigateur', () => {
    creditWallet('boss:42', coinReward({ score: 30_000, stars: 0 }))
    const saved = JSON.parse(store.get('fretable.coins.v1')!)
    expect(saved).toMatchObject({ balance: 3000, last: { key: 'boss:42', after: 3000 } })
  })
})
