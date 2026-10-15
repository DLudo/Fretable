import { beforeEach, describe, expect, it, vi } from 'vitest'

import { COIN_RULES } from '@/game/config'
import {
  coinReward,
  coinsForScore,
  completionCoins,
  creditWallet,
  gameCoinKey,
  readWallet,
  receiptFor,
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
    expect(creditWallet('classic:0:1234', reward)).toEqual(first)
    expect(readWallet().balance).toBe(1300)
    // Partie suivante : le solde s'ajoute.
    const next = creditWallet('classic:0:9999', coinReward({ score: 2000, stars: 0 }))
    expect(next).toMatchObject({ before: 1300, after: 1500 })
  })

  it('garde le solde dans le stockage du navigateur', () => {
    creditWallet('boss:42', coinReward({ score: 30_000, stars: 0 }))
    const saved = JSON.parse(store.get('fretable.coins.v1')!)
    expect(saved).toMatchObject({ balance: 3000, receipts: [{ key: 'boss:42', after: 3000 }] })
  })

  it('ne recrédite pas une partie, même après le crédit d’une autre (autre onglet)', () => {
    const first = creditWallet('a', coinReward({ score: 1000, stars: 0 }))
    creditWallet('b', coinReward({ score: 2000, stars: 0 }))
    expect(creditWallet('a', coinReward({ score: 1000, stars: 0 }))).toEqual(first)
    expect(readWallet().balance).toBe(300)
    expect(receiptFor(readWallet(), 'a')).toEqual(first)
  })

  it('relit le stockage avant de créditer : le crédit d’un autre onglet n’est pas écrasé', () => {
    creditWallet('a', coinReward({ score: 1000, stars: 0 }))
    // Un autre onglet crédite 500 pièces de son côté.
    const other = JSON.parse(store.get('fretable.coins.v1')!)
    store.set('fretable.coins.v1', JSON.stringify({ ...other, balance: other.balance + 500 }))
    expect(creditWallet('b', coinReward({ score: 2000, stars: 0 }))).toMatchObject({
      before: 600,
      after: 800,
    })
  })

  it('lit l’ancien format, qui ne gardait que le dernier crédit', () => {
    const last = { key: 'old', reward: coinReward({ score: 500, stars: 0 }), before: 0, after: 50 }
    store.set('fretable.coins.v1', JSON.stringify({ balance: 50, last }))
    expect(creditWallet('old', last.reward)).toEqual(last)
    expect(readWallet().balance).toBe(50)
  })

  it('identifie une partie par son heure absolue, d’un chargement de page à l’autre', () => {
    const key = gameCoinKey('boss', 1234.5)
    expect(key).toMatch(/^boss:\d+\.\d$/)
    // Même instant de page, autre chargement (autre origine) : autre partie.
    vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(performance.timeOrigin + 60_000)
    expect(gameCoinKey('boss', 1234.5)).not.toBe(key)
    vi.restoreAllMocks()
  })
})
