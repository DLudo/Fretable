import { beforeEach, describe, expect, it, vi } from 'vitest'

import { coinsForScore, creditWallet, readWallet, resetWallet } from '@/game/coins'
import { COMBO_RULES, ITEM_RULES, RATING_RULES } from '@/game/config'
import { gameReducer } from '@/game/engine/reducer'
import { comboCapacityMs, stepCombo } from '@/game/engine/scoring'
import { NO_PERKS } from '@/game/engine/types'
import {
  buyItem,
  consumeArmed,
  hasUpgrade,
  isArmed,
  maxClassicScore,
  ownedCount,
  perksFor,
  setArmed,
} from '@/game/items'
import { LEVELS } from '@/game/levels/levels'

import { testState } from './fixtures'

describe('lampes en surchauffe', () => {
  it('coûtent toujours plus que tout ce qu’elles peuvent rapporter', () => {
    for (const level of LEVELS) {
      const max = maxClassicScore(level)
      const gain = coinsForScore(max * ITEM_RULES.lamps.scoreMultiplier) - coinsForScore(max)
      expect(ITEM_RULES.lamps.price).toBeGreaterThan(gain)
    }
  })

  it('se mesurent à une borne bien au-dessus d’une partie parfaite à l’allure étalon', () => {
    // 18 000 points à 1,5 s par note sans faute (niveau 1) : la borne est loin au-dessus.
    expect(maxClassicScore(LEVELS[0])).toBeGreaterThan(18_000 * 3)
    expect(RATING_RULES.referencePaceMs).toBe(1500)
  })
})

describe('inventaire', () => {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  /** Portefeuille garni de `coins` pièces. */
  const fund = (coins: number) =>
    creditWallet(`test:${coins}:${Math.random()}`, {
      fromScore: coins,
      completion: 0,
      stars: 0,
      total: coins,
    })

  beforeEach(() => {
    store.clear()
    resetWallet()
  })

  it('achète un consommable : le prix est débité et la réserve grossit', () => {
    expect(buyItem('lamps')).toBe('insufficient')
    const funds = 2.5 * ITEM_RULES.lamps.price
    fund(funds)
    expect(buyItem('lamps')).toBe('bought')
    expect(buyItem('lamps')).toBe('bought')
    expect(buyItem('lamps')).toBe('insufficient')
    const wallet = readWallet()
    expect(wallet.balance).toBe(funds - 2 * ITEM_RULES.lamps.price)
    expect(ownedCount(wallet.inventory, 'lamps')).toBe(2)
  })

  it('n’achète une amélioration qu’une fois', () => {
    fund(200_000)
    expect(buyItem('amp50')).toBe('bought')
    expect(buyItem('amp50')).toBe('owned')
    const wallet = readWallet()
    expect(wallet.balance).toBe(200_000 - ITEM_RULES.amp50.price)
    expect(hasUpgrade(wallet.inventory, 'amp50')).toBe(true)
  })

  it('active un consommable pour la prochaine partie, qui en consomme un', () => {
    setArmed('lamps', true)
    expect(isArmed(readWallet().inventory, 'lamps')).toBe(false) // aucune en réserve
    fund(2 * ITEM_RULES.lamps.price)
    buyItem('lamps')
    buyItem('lamps')
    setArmed('lamps', true)
    expect(isArmed(readWallet().inventory, 'lamps')).toBe(true)
    // Un mode où elles n'agissent pas n'y touche pas.
    expect(consumeArmed([])).toEqual([])
    expect(consumeArmed(['lamps'])).toEqual(['lamps'])
    const after = readWallet().inventory
    expect(ownedCount(after, 'lamps')).toBe(1)
    // Une activation vaut pour une partie : la suivante n'en consomme pas.
    expect(isArmed(after, 'lamps')).toBe(false)
    expect(consumeArmed(['lamps'])).toEqual([])
  })

  it('garde l’inventaire dans le stockage, et en écarte les objets inconnus', () => {
    fund(100_000)
    buyItem('amp50')
    const saved = JSON.parse(store.get('fretable.coins.v1')!)
    expect(saved.inventory).toEqual({ consumables: {}, upgrades: ['amp50'], armed: [] })
    // Stockage écrit par une autre version, ou retouché à la main.
    store.set(
      'fretable.coins.v1',
      JSON.stringify({
        balance: 5,
        receipts: [],
        inventory: {
          consumables: { lamps: 2, mystery: 9 },
          upgrades: ['amp50', 'jetpack'],
          armed: ['lamps', 'mystery'],
        },
      }),
    )
    // Relu au prochain geste.
    setArmed('lamps', true)
    expect(readWallet().inventory).toEqual({
      consumables: { lamps: 2 },
      upgrades: ['amp50'],
      armed: ['lamps'],
    })
  })
})

describe('tête d’ampli 50 watts', () => {
  const bonus = ITEM_RULES.amp50.comboBonusMs

  it('allonge la jauge du combo, à son départ comme en capacité', () => {
    expect(perksFor({ consumables: {}, upgrades: [], armed: [] })).toEqual(NO_PERKS)
    expect(perksFor({ consumables: {}, upgrades: ['amp50'], armed: [] })).toEqual({
      comboBonusMs: bonus,
    })
    const fast = (now: number) => ({ now, correct: true, reactionMs: 800 })
    let step = stepCombo(null, 2, fast(1000), bonus)
    expect(step.combo).toEqual({ startedAt: 1000, endsAt: 1000 + COMBO_RULES.durationMs + bonus })
    // Recharge plafonnée à la capacité agrandie.
    step = stepCombo(step.combo, 0, fast(2000), bonus)
    expect(step.combo?.endsAt).toBe(2000 + comboCapacityMs(bonus))
  })

  it('suit la partie du décompte à la première note, puis s’efface au départ suivant', () => {
    const perks = { comboBonusMs: bonus }
    const starting = gameReducer(testState(), { type: 'prepare', now: 0, perks })
    const challenge = { id: 1, stringIndex: 0, fret: 1, pc: 5 as const }
    const playing = gameReducer(starting, { type: 'start', now: 3000, challenge })
    expect(playing.perks).toEqual(perks)
    const again = gameReducer(playing, { type: 'start', now: 9000, challenge })
    expect(again.perks).toEqual(NO_PERKS)
  })
})
