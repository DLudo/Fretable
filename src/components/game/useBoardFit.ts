import { useLayoutEffect, useState } from 'react'

import { useElementSize } from '@/hooks/useElementSize'

/** Largeur maximale du manche sur grand écran. */
export const BOARD_MAX_WIDTH = '72rem'

/** Téléphone tenu en portrait : le manche passe à la verticale (sillet en haut). */
export const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 639px)'

/**
 * Le manche est dimensionné par la largeur, mais jamais plus haut que l'espace
 * laissé par le HUD et le piano (proportions conservées). `aspectRatio` est
 * celui du manche orienté : à la verticale, c'est donc la hauteur disponible
 * qui fixe sa taille.
 */
export function useBoardFit(aspectRatio: number) {
  const [mainRef, main] = useElementSize<HTMLElement>()
  const [pianoRef, piano] = useElementSize<HTMLDivElement>()
  const [chrome, setChrome] = useState(0)

  // Marges verticales et espacement du conteneur, relus avant affichage quand sa taille change.
  useLayoutEffect(() => {
    const element = mainRef.current
    if (!element) return
    const style = getComputedStyle(element)
    setChrome(
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.rowGap),
    )
  }, [mainRef, main.height])

  const available = main.height - piano.height - chrome
  const maxWidth =
    main.height > 0 && available > 0
      ? `min(${BOARD_MAX_WIDTH}, ${Math.floor(available * aspectRatio)}px)`
      : BOARD_MAX_WIDTH
  return { mainRef, pianoRef, maxWidth }
}
