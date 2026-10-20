import { Suspense, lazy, useCallback, useEffect, useState } from 'react'

import { BossScreen } from '@/components/game/boss'
import { GameScreen } from '@/components/game/GameScreen'
import { HomeButton } from '@/components/game/HomeButton'
import { ModeSwitch } from '@/components/game/ModeSwitch'
import { RotateGuard } from '@/components/game/orientation'
import { HomeScreen } from '@/components/home'
import { InventoryScreen } from '@/components/inventory'

const EffectsLab = lazy(() => import('@/lab/EffectsLab'))

// `?lab` en développement ; `#lab` là où la chaîne de requête n'est pas transmise (page publiée).
const isLab =
  new URLSearchParams(window.location.search).has('lab') || window.location.hash === '#lab'
// `?boss` / `#boss` : ouvre directement le boss final (testeurs).
const startsInBoss =
  new URLSearchParams(window.location.search).has('boss') || window.location.hash === '#boss'

/** Écrans de l'application : accueil, jeu (classique ou boss), inventaire. */
type Screen = 'home' | 'play' | 'inventory'

const isScreen = (value: unknown): value is Screen =>
  value === 'home' || value === 'play' || value === 'inventory'

/**
 * Écran courant, inscrit dans l'historique du navigateur : le geste « retour »
 * d'un téléphone ramène à l'accueil au lieu de quitter le jeu.
 */
function useScreen(initial: Screen): [Screen, (next: Screen) => void] {
  const [screen, setScreen] = useState<Screen>(initial)
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { screen?: unknown } | null
      setScreen(isScreen(state?.screen) ? state.screen : 'home')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = useCallback((next: Screen) => {
    const state = window.history.state as { screen?: unknown } | null
    if (next === 'home') {
      // Revenir sur l'entrée de l'accueil plutôt qu'en empiler une nouvelle.
      if (isScreen(state?.screen)) window.history.back()
      else setScreen('home')
      return
    }
    window.history.pushState({ screen: next }, '')
    setScreen(next)
  }, [])
  return [screen, go]
}

export default function App() {
  const [screen, go] = useScreen(startsInBoss ? 'play' : 'home')
  const [boss, setBoss] = useState(startsInBoss)
  // Bascule au clavier : l'interrupteur du nouvel écran reprend le focus.
  const [focusSwitch, setFocusSwitch] = useState(false)
  const goHome = useCallback(() => go('home'), [go])
  if (isLab) {
    return (
      <Suspense fallback={null}>
        <EffectsLab />
      </Suspense>
    )
  }
  // En tête du HUD : retour à l'accueil, et bascule de mode, qui relance
  // l'écran. L'un comme l'autre abandonnent la partie en cours.
  const leading = (
    <>
      <HomeButton onClick={goHome} />
      <ModeSwitch
        checked={boss}
        autoFocus={focusSwitch}
        onCheckedChange={(next, { keyboard }) => {
          setBoss(next)
          setFocusSwitch(keyboard)
        }}
      />
    </>
  )
  // Le jeu se joue à l'horizontale : en portrait, il invite à tourner l'appareil.
  return (
    <RotateGuard>
      {screen === 'home' ? (
        <HomeScreen onPlay={() => go('play')} onInventory={() => go('inventory')} />
      ) : screen === 'inventory' ? (
        <InventoryScreen onBack={goHome} />
      ) : boss ? (
        <BossScreen modeSwitch={leading} />
      ) : (
        <GameScreen modeSwitch={leading} />
      )}
    </RotateGuard>
  )
}
