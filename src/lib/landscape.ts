import { isTouchDevice } from './touch'

/**
 * Sur écran tactile, passe en plein écran et y verrouille le paysage, au mieux :
 * Android le permet (le verrou exige le plein écran), l'iPhone non (ni l'un ni
 * l'autre), et une page intégrée peut se le voir refuser. Tout échec est
 * silencieux : l'invitation à tourner l'appareil prend alors le relais (voir
 * `RotateGuard`). À appeler depuis un geste du joueur (toucher « Commencer »),
 * seul à pouvoir ouvrir le plein écran.
 */
export async function requestLandscape(): Promise<void> {
  if (!isTouchDevice()) return
  try {
    const root = document.documentElement
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' })
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape') => Promise<void>
    }
    await orientation?.lock?.('landscape')
  } catch {
    // Non pris en charge ou refusé : le joueur tourne lui-même l'appareil.
  }
}
