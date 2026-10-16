import { useLayoutEffect, useState } from 'react'

import { useElementSize } from '@/hooks/useElementSize'

/** Largeur maximale du manche sur grand écran. */
export const BOARD_MAX_WIDTH = '72rem'

/**
 * Écran trop étroit pour le manche : un téléphone tenu en portrait (ou une
 * fenêtre plus haute que large et étroite). Le jeu ne s'y joue pas : il invite
 * à tourner l'appareil (voir `RotateGuard`).
 */
export const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 639px)'

/**
 * Le manche est dimensionné par la largeur, mais jamais plus haut que l'espace
 * laissé par le HUD et le piano (proportions conservées). `reserveShare` garde
 * en plus libre cette part de la hauteur de la scène (la piste des fantômes du
 * boss, entre le manche et le piano).
 */
export function useBoardFit(aspectRatio: number, { reserveShare = 0 } = {}) {
  const [mainRef, main] = useElementSize<HTMLElement>()
  const [pianoRef, piano] = useElementSize<HTMLDivElement>()
  const [chrome, setChrome] = useState(0)

  // Marges verticales et espacement du conteneur, relus avant affichage quand sa taille change.
  useLayoutEffect(() => {
    const element = mainRef.current
    if (!element) return
    const style = getComputedStyle(element)
    // `row-gap: normal` (aucun espacement) se lit comme 0, pas comme NaN.
    const px = (value: string) => parseFloat(value) || 0
    setChrome(px(style.paddingTop) + px(style.paddingBottom) + px(style.rowGap))
  }, [mainRef, main.height])

  const available = main.height * (1 - reserveShare) - piano.height - chrome
  const maxWidth =
    main.height > 0 && available > 0
      ? `min(${BOARD_MAX_WIDTH}, ${Math.floor(available * aspectRatio)}px)`
      : BOARD_MAX_WIDTH
  return { mainRef, pianoRef, maxWidth }
}
