import { useSyncExternalStore } from 'react'

import type { CoinReward } from './reward'

/** Dernier crédit du portefeuille : de quoi rejouer la conversion sans recréditer. */
export interface CoinReceipt {
  /** Identifiant de la partie créditée (voir `creditWallet`). */
  key: string
  reward: CoinReward
  /** Solde avant et après le crédit. */
  before: number
  after: number
}

export interface Wallet {
  balance: number
  last: CoinReceipt | null
}

const STORAGE_KEY = 'fretable.coins.v1'
const EMPTY: Wallet = { balance: 0, last: null }

function parse(raw: string | null): Wallet {
  if (!raw) return EMPTY
  try {
    const data = JSON.parse(raw) as Partial<Wallet>
    const balance = Number.isFinite(data.balance) ? Math.max(0, Math.floor(data.balance!)) : 0
    return { balance, last: data.last ?? null }
  } catch {
    return EMPTY
  }
}

function load(): Wallet {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return EMPTY
  }
}

// Portefeuille en mémoire, recopié dans le stockage du navigateur quand il est
// disponible (navigation privée, stockage bloqué : la partie en cours garde ses
// pièces, sans les conserver).
let wallet: Wallet | null = null
const listeners = new Set<() => void>()

function current(): Wallet {
  wallet ??= typeof window === 'undefined' ? EMPTY : load()
  return wallet
}

function commit(next: Wallet) {
  wallet = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Stockage indisponible : le solde vit le temps de la page.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Un autre onglet a crédité le portefeuille : on relit le stockage.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    wallet = parse(event.newValue)
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** État du portefeuille, tel qu'il est (solde et dernier crédit). */
export function readWallet(): Wallet {
  return current()
}

/**
 * Crédite le portefeuille des pièces d'une partie, une seule fois par partie :
 * un second appel avec la même `key` (double rendu, écran de fin rouvert) ne
 * crédite rien et rend le reçu du premier.
 */
export function creditWallet(key: string, reward: CoinReward): CoinReceipt {
  const state = current()
  if (state.last?.key === key) return state.last
  const before = state.balance
  const receipt: CoinReceipt = { key, reward, before, after: before + reward.total }
  commit({ balance: receipt.after, last: receipt })
  return receipt
}

/** Remet le portefeuille à zéro (tests, réglages). */
export function resetWallet() {
  commit(EMPTY)
}

/** Portefeuille courant, mis à jour à chaque crédit (y compris depuis un autre onglet). */
export function useWallet(): Wallet {
  return useSyncExternalStore(subscribe, current, () => EMPTY)
}
