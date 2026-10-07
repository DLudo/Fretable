import type { Box, Point } from './geometry'

/**
 * Orientation d'affichage du manche.
 * - `horizontal` : sillet à gauche, cordes aiguës en haut (comme une tablature).
 * - `vertical` : rotation de +90°, sillet en haut, corde grave à gauche
 *   (comme un diagramme d'accords) — utile sur téléphone en portrait.
 */
export type BoardOrientation = 'horizontal' | 'vertical'

/** Transformation SVG à appliquer au contenu du manche (dessiné à l'horizontale). */
export const ORIENTATION_TRANSFORM: Record<BoardOrientation, string | undefined> = {
  horizontal: undefined,
  vertical: 'rotate(90)',
}

/** Point du manche après orientation : rotate(90) envoie (x, y) sur (−y, x). */
export function orientPoint(point: Point, orientation: BoardOrientation): Point {
  return orientation === 'horizontal' ? point : { x: -point.y, y: point.x }
}

/** Cadre de rendu (viewBox) une fois le manche orienté. */
export function orientViewBox(viewBox: Box, orientation: BoardOrientation): Box {
  if (orientation === 'horizontal') return viewBox
  return {
    x: -(viewBox.y + viewBox.height),
    y: viewBox.x,
    width: viewBox.height,
    height: viewBox.width,
  }
}

/**
 * Passage de l'espace du manche (mm, géométrie horizontale) aux pixels du
 * conteneur, orientation comprise. Reproduit `preserveAspectRatio="xMidYMid meet"`
 * appliqué au viewBox orienté.
 */
export interface BoardProjection {
  toPx(point: Point): Point
  pxPerMm: number
  width: number
  height: number
  orientation: BoardOrientation
}

export function createProjection(
  viewBox: Box,
  width: number,
  height: number,
  orientation: BoardOrientation = 'horizontal',
): BoardProjection {
  const box = orientViewBox(viewBox, orientation)
  const scale = Math.min(width / box.width, height / box.height) || 0
  const offsetX = (width - box.width * scale) / 2
  const offsetY = (height - box.height * scale) / 2
  return {
    pxPerMm: scale,
    width,
    height,
    orientation,
    toPx: (point) => {
      const { x, y } = orientPoint(point, orientation)
      return { x: offsetX + (x - box.x) * scale, y: offsetY + (y - box.y) * scale }
    },
  }
}
