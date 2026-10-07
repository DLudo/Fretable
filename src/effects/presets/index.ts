import type { RevealEffect } from '../types'

/**
 * Auto-découverte des effets : tout objet `RevealEffect` exporté par un fichier
 * `.tsx` de ce dossier, ou par le `index.tsx` d'un sous-dossier (effet livré
 * avec ses fichiers .riv, .json, images…), est enregistré. Pour ajouter une
 * animation conçue en isolation, déposez simplement son fichier ici.
 */
const modules = import.meta.glob<Record<string, unknown>>(['./*.tsx', './*/index.tsx'], {
  eager: true,
})

export function isRevealEffect(value: unknown): value is RevealEffect {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<RevealEffect>
  return (
    typeof v.id === 'string' &&
    Array.isArray(v.outcomes) &&
    (typeof v.Component === 'function' || typeof v.Component === 'object')
  )
}

export const PRESET_EFFECTS: readonly RevealEffect[] = Object.values(modules)
  .flatMap((mod) => Object.values(mod).filter(isRevealEffect))
  .sort((a, b) => a.id.localeCompare(b.id))
