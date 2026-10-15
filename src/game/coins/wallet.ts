import { useSyncExternalStore } from 'react'

import type { CoinReward } from './reward'

/** Crédit d'une partie : de quoi rejouer sa conversion sans recréditer. */
export interface CoinReceipt {
  /** Identifiant de la partie créditée (voir `gameCoinKey`). */
  key: string
  reward: CoinReward
  /** Solde avant et après le crédit. */
  before: number
  after: number
}

export interface Wallet {
  balance: number
  /** Derniers crédits, du plus ancien au plus récent (`RECEIPTS_KEPT` au plus). */
  receipts: readonly CoinReceipt[]
}

const STORAGE_KEY = 'fretable.coins.v1'
/** Crédits retenus : une partie déjà créditée ne l'est jamais deux fois. */
const RECEIPTS_KEPT = 20
const EMPTY: Wallet = { balance: 0, receipts: [] }

function parse(raw: string | null): Wallet {
  if (!raw) return EMPTY
  try {
    const data = JSON.parse(raw) as Partial<Wallet> & { last?: CoinReceipt | null }
    const balance =
      typeof data.balance === 'number' && Number.isFinite(data.balance)
        ? Math.max(0, Math.floor(data.balance))
        : 0
    // Premier format : seul le dernier crédit était gardé.
    const receipts = Array.isArray(data.receipts) ? data.receipts : data.last ? [data.last] : []
    return { balance, receipts }
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
// disponible (navigation privée, stockage bloqué : la page garde ses pièces,
// sans les conserver).
let wallet: Wallet | null = null
let storable = true
const listeners = new Set<() => void>()

function current(): Wallet {
  wallet ??= typeof window === 'undefined' ? EMPTY : load()
  return wallet
}

function commit(next: Wallet) {
  wallet = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    storable = true
  } catch {
    storable = false
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

/** État du portefeuille : solde et derniers crédits. */
export function readWallet(): Wallet {
  return current()
}

/**
 * Crédite le portefeuille des pièces d'une partie, une seule fois par partie :
 * un second appel avec la même `key` (double rendu, écran de fin rouvert) ne
 * crédite rien et rend le reçu du premier, tant qu'il compte parmi les
 * `RECEIPTS_KEPT` derniers crédits. Le stockage est relu juste avant : un
 * crédit fait entre-temps dans un autre onglet n'est pas écrasé.
 */
export function creditWallet(key: string, reward: CoinReward): CoinReceipt {
  const state = storable && typeof window !== 'undefined' ? load() : current()
  wallet = state
  const known = state.receipts.find((receipt) => receipt.key === key)
  if (known) return known
  const before = state.balance
  const receipt: CoinReceipt = { key, reward, before, after: before + reward.total }
  commit({
    balance: receipt.after,
    receipts: [...state.receipts, receipt].slice(-RECEIPTS_KEPT),
  })
  return receipt
}

/** Reçu du crédit d'une partie, s'il compte parmi les derniers. */
export function receiptFor(state: Wallet, key: string): CoinReceipt | null {
  return state.receipts.find((receipt) => receipt.key === key) ?? null
}

/** Remet le portefeuille à zéro (tests, réglages). */
export function resetWallet() {
  commit(EMPTY)
}

/** Portefeuille courant, mis à jour à chaque crédit (y compris depuis un autre onglet). */
export function useWallet(): Wallet {
  return useSyncExternalStore(subscribe, current, () => EMPTY)
}

/**
 * Identifiant d'une partie pour le portefeuille : son mode, son niveau et
 * l'heure absolue de son départ. `startedAt` vient de l'horloge de la page
 * (`performance.now()`), qui repart de zéro à chaque chargement : l'origine
 * de cette horloge la rend unique d'un chargement à l'autre.
 */
export function gameCoinKey(mode: string, startedAt: number): string {
  const origin = typeof performance === 'undefined' ? 0 : performance.timeOrigin
  return `${mode}:${(origin + startedAt).toFixed(1)}`
}
