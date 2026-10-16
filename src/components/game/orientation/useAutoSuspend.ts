import { useEffect, useSyncExternalStore } from 'react'

import { PORTRAIT_QUERY } from '@/components/game/useBoardFit'
import { useMediaQuery } from '@/hooks/useMediaQuery'

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

const isHidden = () => document.visibilityState === 'hidden'

/** Le jeu ne peut pas se jouer : écran en portrait (voir `RotateGuard`). */
export function usePortraitBlocked(): boolean {
  return useMediaQuery(PORTRAIT_QUERY)
}

/**
 * Suspend la partie en cours (`active`) dès que le joueur n'est plus là : écran
 * passé en portrait, page masquée (autre application, écran verrouillé). La
 * reprise, elle, reste un geste du joueur (« Reprendre »), qui doit d'abord
 * avoir le jeu sous les yeux.
 */
export function useAutoSuspend(active: boolean, suspend: () => void): void {
  const blocked = usePortraitBlocked()
  const hidden = useSyncExternalStore(subscribeVisibility, isHidden, () => false)
  useEffect(() => {
    if (active && (blocked || hidden)) suspend()
  }, [active, blocked, hidden, suspend])
}
